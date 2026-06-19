import "server-only";

import WebSocket from "ws";

const DEFAULT_WS_URL =
  (process.env.INTERHUMAN_STREAM_URL && process.env.INTERHUMAN_STREAM_URL.trim()) ||
  "wss://api.interhuman.ai/v1/stream/analyze";

const SESSION_TTL_MS = 10 * 60_000;
const REAP_INTERVAL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;

export interface StreamSession {
  id: string;
  submissionId: string;
  token: string;
  ws: WebSocket;
  ready: boolean;
  correlationId: string | null;
  createdAt: number;
  lastActivity: number;
  listeners: Set<(event: string) => void>;
  buffer: string[];
  counts: Record<string, number>;
}

interface SessionManager {
  sessions: Map<string, StreamSession>;
  reaper: NodeJS.Timeout | null;
}

const globalForRelay = globalThis as unknown as { __ihRelay?: SessionManager };
const manager: SessionManager =
  globalForRelay.__ihRelay ??
  (globalForRelay.__ihRelay = { sessions: new Map(), reaper: null });

if (!manager.reaper) {
  manager.reaper = setInterval(() => {
    const now = Date.now();
    manager.sessions.forEach((s, id) => {
      if (now - s.lastActivity > SESSION_TTL_MS) {
        try {
          s.ws.close(1000);
        } catch {
          /* noop */
        }
        manager.sessions.delete(id);
      }
    });
  }, REAP_INTERVAL_MS);
}

export interface CreateSessionInput {
  submissionId: string;
  token: string;
  apiKey: string;
  config?: Record<string, unknown>;
  wsUrl?: string;
}

export async function createStreamSession(
  input: CreateSessionInput,
): Promise<StreamSession> {
  const { submissionId, token, apiKey, config, wsUrl } = input;
  const id = crypto.randomUUID();
  const url = wsUrl ?? DEFAULT_WS_URL;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const session: StreamSession = {
      id,
      submissionId,
      token,
      ws,
      ready: false,
      correlationId: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      listeners: new Set(),
      buffer: [],
      counts: {},
    };

    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      reject(new Error("WebSocket connection timeout"));
    }, CONNECT_TIMEOUT_MS);

    ws.on("open", () => {
      clearTimeout(timeout);
      session.ready = true;
      manager.sessions.set(id, session);
      if (config) {
        try {
          ws.send(JSON.stringify(config));
        } catch {
          /* noop */
        }
      }
      resolve(session);
    });

    ws.on("message", (raw) => {
      session.lastActivity = Date.now();
      const msg = raw.toString();
      let parsedType = "unknown";
      try {
        const parsed = JSON.parse(msg) as { type?: string; correlation_id?: string };
        if (!session.correlationId && parsed.correlation_id) {
          session.correlationId = parsed.correlation_id;
        }
        if (parsed.type) parsedType = parsed.type;
      } catch {
        /* noop */
      }
      session.counts[parsedType] = (session.counts[parsedType] ?? 0) + 1;
      console.info("[ih-relay] envelope", {
        sessionId: session.id,
        submissionId: session.submissionId,
        type: parsedType,
        bytes: msg.length,
        ...(parsedType === "error" ? { body: msg.slice(0, 500) } : {}),
      });
      session.buffer.push(msg);
      if (session.buffer.length > 500) session.buffer.shift();
      session.listeners.forEach((listener) => listener(msg));
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      session.ready = false;
      manager.sessions.delete(id);
      console.error("[ih-relay] ws error", {
        sessionId: session.id,
        submissionId: session.submissionId,
        message: err instanceof Error ? err.message : String(err),
      });
      reject(err);
    });

    ws.on("close", (code, reason) => {
      session.ready = false;
      const closed = JSON.stringify({ type: "connection.closed" });
      session.listeners.forEach((listener) => listener(closed));
      manager.sessions.delete(id);
      console.info("[ih-relay] ws closed", {
        sessionId: session.id,
        submissionId: session.submissionId,
        code,
        reason: reason?.toString() ?? "",
        counts: session.counts,
      });
    });
  });
}

export function getStreamSession(id: string): StreamSession | undefined {
  return manager.sessions.get(id);
}

export function closeStreamSession(id: string): void {
  const s = manager.sessions.get(id);
  if (!s) return;
  try {
    s.ws.close(1000);
  } catch {
    /* noop */
  }
  manager.sessions.delete(id);
}

export function sendSegment(session: StreamSession, body: ArrayBuffer): void {
  if (!session.ready || session.ws.readyState !== WebSocket.OPEN) {
    throw new Error("Session not connected");
  }
  session.ws.send(Buffer.from(body));
  session.lastActivity = Date.now();
}

export function subscribe(
  session: StreamSession,
  listener: (event: string) => void,
): () => void {
  session.listeners.add(listener);
  session.buffer.forEach((evt) => listener(evt));
  return () => {
    session.listeners.delete(listener);
  };
}
