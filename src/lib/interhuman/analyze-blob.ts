import "server-only";

import WebSocket from "ws";

import type {
  ConversationQualityValues,
  EngagementState,
  EngagementStateEntry,
  InterhumanAnalysisResponse,
  SignalEntry,
  SignalProbability,
  SignalType,
  TimelineEntry,
} from "@/types";

const DEFAULT_WS_URL =
  (process.env.INTERHUMAN_STREAM_URL && process.env.INTERHUMAN_STREAM_URL.trim()) ||
  "wss://api.interhuman.ai/v1/stream/analyze";

const CONNECT_TIMEOUT_MS = 10_000;
// Interhuman streams nothing for the first ~10s while it processes, then emits
// bursts with gaps up to ~6s between them. There is no completion event, so we
// rely on a quiet window after the last *analysis* event — it must be longer
// than the largest inter-burst gap or we'd finalize mid-stream.
const TRAILING_QUIET_MS = 12_000;
// If no analysis event arrives within this window after the upload, give up and
// finalize with whatever we have (usually nothing → delivery fallback).
const WARMUP_TIMEOUT_MS = 60_000;
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
  // Signals stream as a `signal.detected` (start) followed later by a
  // `signal.ended` (end). Track open signals by type until they close.
  const openSignals = new Map<
    SignalType,
    { start: number; probability: SignalProbability; rationale: string }
  >();
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
    let receivedAnalysis = false;
    let trailingTimer: NodeJS.Timeout | null = null;
    let warmupTimer: NodeJS.Timeout | null = null;
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

    // Close out any signals that never received a `signal.ended` (e.g. the
    // signal was still active when the recording ended).
    const flushOpenSignals = (): void => {
      openSignals.forEach((open, type) => {
        signals.push({
          type,
          start: open.start,
          end: open.start,
          probability: open.probability,
          rationale: open.rationale,
        });
      });
      openSignals.clear();
    };

    const finalize = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (trailingTimer) clearTimeout(trailingTimer);
      if (warmupTimer) clearTimeout(warmupTimer);
      flushOpenSignals();
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

    // Re-arm the quiet timer after each analysis event. Only finalize once the
    // stream has been quiet for the full window — long enough to ride over the
    // multi-second gaps between Interhuman's bursts.
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

    // Mark that real analysis data has started flowing and (re)arm the quiet
    // timer. Called from the analysis-event branches below.
    const noteAnalysisEvent = () => {
      receivedAnalysis = true;
      if (warmupTimer) {
        clearTimeout(warmupTimer);
        warmupTimer = null;
      }
      armTrailingTimer();
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
            if (warmupTimer) clearTimeout(warmupTimer);
            reject(err);
          }
          return;
        }
        // Analysis events don't begin for ~10s after upload. Don't arm the
        // quiet timer yet — wait for the first real event, but bail out if
        // nothing ever arrives.
        warmupTimer = setTimeout(() => {
          if (!settled && !receivedAnalysis) finalize();
        }, WARMUP_TIMEOUT_MS);
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
          // Interhuman sends a flat signal with a start time; the matching end
          // arrives later in a `signal.ended`. Hold it open until then.
          const signalType = data?.signal_type as SignalType | undefined;
          if (signalType) {
            openSignals.set(signalType, {
              start: (data?.start as number) ?? 0,
              probability: (data?.probability as SignalProbability) ?? "medium",
              rationale: (data?.rationale as string) ?? "",
            });
          }
          noteAnalysisEvent();
          break;
        }
        case "signal.ended": {
          const signalType = data?.signal_type as SignalType | undefined;
          if (signalType && openSignals.has(signalType)) {
            const open = openSignals.get(signalType)!;
            signals.push({
              type: signalType,
              start: open.start,
              end: (data?.end as number) ?? open.start,
              probability: open.probability,
              rationale: open.rationale,
            });
            openSignals.delete(signalType);
          }
          noteAnalysisEvent();
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
          noteAnalysisEvent();
          break;
        }
        case "conversation_quality.updated": {
          const overall = data?.overall as ConversationQualityValues | undefined;
          const timeline = data?.timeline as TimelineEntry[] | undefined;
          if (overall) quality.overall = overall;
          if (Array.isArray(timeline) && timeline.length) {
            quality.timeline.push(...timeline);
          }
          noteAnalysisEvent();
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
            if (warmupTimer) clearTimeout(warmupTimer);
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
      if (warmupTimer) clearTimeout(warmupTimer);
      reject(err);
    });

    ws.on("close", () => {
      // If upstream closed before we finalized, treat the buffered envelopes
      // as the final result rather than failing.
      if (!settled) finalize();
    });
  });
}
