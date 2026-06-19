"use client";

import {
  extractInitSegment,
  prependInitSegment,
} from "@/lib/interhuman/webm-segment";
import type {
  InterhumanAnalysisResponse,
  SignalEntry,
  EngagementStateEntry,
  EngagementState,
  ConversationQualityValues,
  TimelineEntry,
} from "@/types";

export type StreamEvent =
  | { type: "signal.detected"; signals: SignalEntry[] }
  | { type: "engagement.updated"; state: string; start: number; end: number }
  | {
      type: "conversation_quality.updated";
      overall?: ConversationQualityValues;
      timeline?: TimelineEntry[];
    }
  | { type: "error"; code: string; message: string };

export type StreamSessionConfig = {
  include?: string[];
};

export type InterhumanStreamCallbacks = {
  onSignal?: (signals: SignalEntry[]) => void;
  onEngagement?: (entry: EngagementStateEntry) => void;
  onConversationQuality?: (data: {
    overall?: ConversationQualityValues;
    timeline?: TimelineEntry[];
  }) => void;
  onError?: (code: string, message: string) => void;
  onClose?: () => void;
  onOpen?: () => void;
};

export interface StreamSessionAuth {
  sessionId: string;
  token: string;
}

export class InterhumanStream {
  private sessionId: string | null = null;
  private token: string | null = null;
  private eventSource: EventSource | null = null;
  private initSegment: Uint8Array | null = null;
  private signals: SignalEntry[] = [];
  private engagementStates: EngagementStateEntry[] = [];
  private conversationQuality: {
    overall?: ConversationQualityValues;
    timeline: TimelineEntry[];
  } = { timeline: [] };
  private callbacks: InterhumanStreamCallbacks;
  private opened = false;

  constructor(callbacks: InterhumanStreamCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async connect(config?: StreamSessionConfig): Promise<void> {
    const res = await fetch("/api/stream/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config ? { config } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to start stream session (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { sessionId: string; token: string };
    this.sessionId = data.sessionId;
    this.token = data.token;

    const url = new URL("/api/stream", window.location.origin);
    url.searchParams.set("sessionId", this.sessionId);
    url.searchParams.set("token", this.token);
    const es = new EventSource(url.toString());
    this.eventSource = es;

    return new Promise((resolve, reject) => {
      const failTimeout = setTimeout(() => {
        if (!this.opened) {
          es.close();
          this.eventSource = null;
          reject(new Error("Stream SSE failed to open within 10s"));
        }
      }, 10_000);

      es.onmessage = (e) => {
        if (!this.opened) {
          this.opened = true;
          clearTimeout(failTimeout);
          this.callbacks.onOpen?.();
          resolve();
        }
        try {
          this.handleEnvelope(e.data);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (!this.opened) {
          clearTimeout(failTimeout);
          es.close();
          this.eventSource = null;
          reject(new Error("Stream SSE connection failed"));
        }
        // Browser auto-reconnects after open; nothing else to do here.
      };
    });
  }

  getAuth(): StreamSessionAuth | null {
    if (!this.sessionId || !this.token) return null;
    return { sessionId: this.sessionId, token: this.token };
  }

  private handleEnvelope(raw: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const { type, data } = payload as {
      type?: string;
      data?: Record<string, unknown>;
    };

    switch (type) {
      case "signal.detected": {
        const signals = data?.signals as SignalEntry[] | undefined;
        if (signals && signals.length) {
          this.signals.push(...signals);
          this.callbacks.onSignal?.(signals);
        }
        break;
      }
      case "engagement.updated": {
        if (data) {
          const entry: EngagementStateEntry = {
            state: data.state as EngagementState,
            start: data.start as number,
            end: data.end as number,
          };
          this.engagementStates.push(entry);
          this.callbacks.onEngagement?.(entry);
        }
        break;
      }
      case "conversation_quality.updated": {
        const overall = data?.overall as ConversationQualityValues | undefined;
        const timeline = data?.timeline as TimelineEntry[] | undefined;
        if (overall) this.conversationQuality.overall = overall;
        if (timeline) this.conversationQuality.timeline.push(...timeline);
        this.callbacks.onConversationQuality?.({ overall, timeline });
        break;
      }
      case "error": {
        const code = (data?.code as string) ?? "unknown";
        const message = (data?.message as string) ?? "Unknown streaming error";
        this.callbacks.onError?.(code, message);
        break;
      }
      case "connection.closed": {
        this.callbacks.onClose?.();
        break;
      }
    }
  }

  /**
   * Forward a recorded WebM chunk to the relay.
   *
   * The first chunk carries the WebM init/header bytes (everything before the
   * first Cluster element). For every subsequent chunk we re-prepend that
   * init segment so each upload is a self-contained, decodable WebM segment —
   * without it the upstream silently drops mid-stream chunks.
   */
  async sendSegment(chunk: Blob): Promise<void> {
    if (!this.sessionId || !this.token) return;
    if (chunk.size === 0) return;

    let body: Blob = chunk;
    if (!this.initSegment) {
      const init = await extractInitSegment(chunk);
      if (init) {
        this.initSegment = init;
      }
    } else {
      const buf = new Uint8Array(await chunk.arrayBuffer());
      const merged = prependInitSegment(this.initSegment, buf);
      body = new Blob([new Uint8Array(merged)], { type: "video/webm" });
    }

    try {
      await fetch("/api/stream", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-stream-session-id": this.sessionId,
          "x-stream-token": this.token,
        },
        body,
      });
    } catch {
      /* drop chunk; relay is best-effort */
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  get isConnected(): boolean {
    return this.opened && this.eventSource?.readyState === EventSource.OPEN;
  }

  getAccumulatedResults(): InterhumanAnalysisResponse {
    return {
      signals: this.signals,
      engagement_state: this.engagementStates,
      conversation_quality:
        this.conversationQuality.overall ||
        this.conversationQuality.timeline.length > 0
          ? {
              overall: this.conversationQuality.overall || {
                quality_index: 50,
                energy: 50,
                rapport: 50,
                authority: 50,
                learning: 50,
                clarity: 50,
              },
              timeline: this.conversationQuality.timeline,
            }
          : undefined,
    };
  }

  reset(): void {
    this.signals = [];
    this.engagementStates = [];
    this.conversationQuality = { timeline: [] };
    this.initSegment = null;
    this.opened = false;
  }
}
