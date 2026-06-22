import "server-only";

import WebSocket from "ws";

import type {
  ConversationQualityValues,
  EngagementState,
  EngagementStateEntry,
  InterhumanAnalysisResponse,
  SignalEntry,
  TimelineEntry,
} from "@/types";

const DEFAULT_WS_URL =
  (process.env.INTERHUMAN_STREAM_URL && process.env.INTERHUMAN_STREAM_URL.trim()) ||
  "wss://api.interhuman.ai/v1/stream/analyze";

const CONNECT_TIMEOUT_MS = 10_000;
const TRAILING_QUIET_MS = 4_000;
const HARD_TIMEOUT_MS = 280_000;

export interface AnalyzeBlobInput {
  bytes: Uint8Array;
  apiKey: string;
  config?: Record<string, unknown>;
  wsUrl?: string;
  contentType?: string;
}

export async function analyzeBlobOverWs(
  input: AnalyzeBlobInput,
): Promise<InterhumanAnalysisResponse> {
  const { bytes, apiKey, config, wsUrl } = input;
  const url = wsUrl ?? DEFAULT_WS_URL;

  const signals: SignalEntry[] = [];
  const engagementStates: EngagementStateEntry[] = [];
  const quality: {
    overall?: ConversationQualityValues;
    timeline: TimelineEntry[];
  } = { timeline: [] };

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    let settled = false;
    let lastEventAt = Date.now();
    let trailingTimer: NodeJS.Timeout | null = null;
    const hardTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close(1000);
      } catch {
        /* noop */
      }
      reject(new Error("Interhuman analysis timed out"));
    }, HARD_TIMEOUT_MS);

    const connectTimer = setTimeout(() => {
      if (settled || ws.readyState === WebSocket.OPEN) return;
      settled = true;
      clearTimeout(hardTimer);
      try {
        ws.close();
      } catch {
        /* noop */
      }
      reject(new Error("WebSocket connection timeout"));
    }, CONNECT_TIMEOUT_MS);

    const finalize = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (trailingTimer) clearTimeout(trailingTimer);
      try {
        ws.close(1000);
      } catch {
        /* noop */
      }
      resolve({
        signals,
        engagement_state: engagementStates,
        conversation_quality:
          quality.overall || quality.timeline.length > 0
            ? {
                overall:
                  quality.overall ?? {
                    quality_index: 50,
                    energy: 50,
                    rapport: 50,
                    authority: 50,
                    learning: 50,
                    clarity: 50,
                  },
                timeline: quality.timeline,
              }
            : undefined,
      });
    };

    const armTrailingTimer = () => {
      if (trailingTimer) clearTimeout(trailingTimer);
      trailingTimer = setTimeout(() => {
        if (Date.now() - lastEventAt >= TRAILING_QUIET_MS) {
          finalize();
        } else {
          armTrailingTimer();
        }
      }, TRAILING_QUIET_MS);
    };

    ws.on("open", () => {
      clearTimeout(connectTimer);
      if (config) {
        try {
          ws.send(JSON.stringify(config));
        } catch {
          /* noop */
        }
      }

      // Interhuman expects each WS binary message to be a self-contained
      // WebM segment. Splitting the file across multiple messages lands on
      // arbitrary byte offsets inside Clusters and trips ih5004
      // (malformed/truncated). Send the whole blob as one message.
      ws.send(bytes, { binary: true }, (err) => {
        if (err) {
          if (!settled) {
            settled = true;
            clearTimeout(hardTimer);
            if (trailingTimer) clearTimeout(trailingTimer);
            reject(err);
          }
          return;
        }
        armTrailingTimer();
      });
    });

    ws.on("message", (raw) => {
      lastEventAt = Date.now();
      const msg = typeof raw === "string" ? raw : raw.toString();
      let parsed: { type?: string; data?: Record<string, unknown> } | null = null;
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }
      if (!parsed) return;
      const { type, data } = parsed;
      switch (type) {
        case "signal.detected": {
          const incoming = data?.signals as SignalEntry[] | undefined;
          if (Array.isArray(incoming) && incoming.length) signals.push(...incoming);
          break;
        }
        case "engagement.updated": {
          if (data) {
            engagementStates.push({
              state: data.state as EngagementState,
              start: data.start as number,
              end: data.end as number,
            });
          }
          break;
        }
        case "conversation_quality.updated": {
          const overall = data?.overall as ConversationQualityValues | undefined;
          const timeline = data?.timeline as TimelineEntry[] | undefined;
          if (overall) quality.overall = overall;
          if (Array.isArray(timeline) && timeline.length) {
            quality.timeline.push(...timeline);
          }
          break;
        }
        case "analysis.complete":
        case "session.complete": {
          finalize();
          break;
        }
        case "error": {
          if (!settled) {
            settled = true;
            clearTimeout(hardTimer);
            if (trailingTimer) clearTimeout(trailingTimer);
            try {
              ws.close();
            } catch {
              /* noop */
            }
            const code = (data?.code as string) ?? "unknown";
            const message = (data?.message as string) ?? "Upstream error";
            reject(new Error(`Interhuman error [${code}]: ${message}`));
          }
          break;
        }
      }
    });

    ws.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(hardTimer);
      if (trailingTimer) clearTimeout(trailingTimer);
      reject(err);
    });

    ws.on("close", () => {
      // If upstream closed before we finalized, treat the buffered envelopes
      // as the final result rather than failing.
      if (!settled) finalize();
    });
  });
}
