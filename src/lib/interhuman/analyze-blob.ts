import "server-only";

import WebSocket from "ws";

import { buildWebmFrames } from "./webm-chunks";

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
// bursts with gaps between them. Observed gaps reach ~12s (e.g. between a
// signal.detected and its signal.ended). There is no completion event, so we
// rely on a quiet window after the last *analysis* event — it must comfortably
// exceed the largest inter-burst gap or we'd finalize mid-stream and drop or
// mis-bound signals. 20s gives real margin over the ~12s observed gaps.
const TRAILING_QUIET_MS = 20_000;
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
  /** Recording length, used to bound a signal that never received an end. */
  durationSeconds?: number;
  /**
   * Byte size of each WebM segment the browser's MediaRecorder emitted (one per
   * ~3s timeslice), in order. When present, the blob is sent as one WS message
   * per segment using these exact boundaries — the browser guarantees each is a
   * valid segment, which a server-side parser cannot. When absent or invalid,
   * we fall back to buildWebmFrames.
   */
  segmentSizes?: number[];
}

/**
 * Slice the blob into frames at the browser's exact segment boundaries. Returns
 * null if the sizes don't add up to the blob (truncated upload, re-encoded
 * blob, etc.) so the caller can fall back rather than send malformed segments.
 */
function framesFromSegmentSizes(
  bytes: Uint8Array,
  sizes: number[],
): Uint8Array[] | null {
  if (!sizes.length) return null;
  const total = sizes.reduce((n, s) => n + s, 0);
  if (total !== bytes.byteLength) return null; // boundaries don't match the blob
  const frames: Uint8Array[] = [];
  let offset = 0;
  for (const size of sizes) {
    if (size <= 0) return null;
    frames.push(bytes.subarray(offset, offset + size));
    offset += size;
  }
  return frames;
}

export async function analyzeBlobOverWs(
  input: AnalyzeBlobInput,
): Promise<InterhumanAnalysisResponse> {
  const { bytes, apiKey, config, wsUrl, durationSeconds, segmentSizes } = input;
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
    // How we framed the upload — folded into upstream errors so a failure tells
    // us whether it was a single verbatim send or a multi-frame chunked send.
    let frameInfo = "frames=?";
    // Diagnostics: the WS close frame (code + reason) usually carries the real
    // cause (e.g. 1009 "message too big", 1008 policy/auth). A failed `ws.send`
    // surfaces a bare EPIPE *before* that close frame arrives, so we capture the
    // close info here and let send-failure paths wait briefly for it.
    let closeCode: number | null = null;
    let closeReason = "";
    const clearAllTimers = () => {
      clearTimeout(hardTimer);
      clearTimeout(connectTimer);
      if (trailingTimer) clearTimeout(trailingTimer);
      if (warmupTimer) clearTimeout(warmupTimer);
    };
    // Reject with the underlying error enriched by whatever close code/reason
    // upstream sent. If the close frame hasn't landed yet (typical for EPIPE),
    // wait up to 1.5s for it before giving up so the report isn't just "EPIPE".
    const rejectWithCloseInfo = (stage: string, err: Error) => {
      if (settled) return;
      settled = true; // claim the promise; defer the actual reject for close info
      clearAllTimers();
      const finishReject = () => {
        const closeInfo =
          closeCode !== null
            ? ` [ws close ${closeCode}${closeReason ? ` "${closeReason}"` : ""}]`
            : " [no ws close frame received]";
        const enriched = new Error(
          `Interhuman ${stage} failed (blob ${bytes.byteLength} bytes): ${err.message}${closeInfo}`,
        );
        console.error(`[analyze-blob] ${stage} failed`, {
          blobBytes: bytes.byteLength,
          errorMessage: err.message,
          closeCode,
          closeReason,
        });
        reject(enriched);
      };
      if (closeCode !== null) {
        finishReject();
      } else {
        setTimeout(finishReject, 1_500);
      }
    };
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
        // No end arrived — extend to the recording's end (or, if duration is
        // unknown, a 1s minimum) so the signal renders as a real interval
        // rather than a zero-width blip at its start.
        const fallbackEnd =
          durationSeconds && durationSeconds > open.start
            ? durationSeconds
            : open.start + 1;
        signals.push({
          type,
          start: open.start,
          end: fallbackEnd,
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
      console.log("[analyze-blob] ws open, sending", bytes.byteLength, "bytes");
      if (config) {
        ws.send(JSON.stringify(config), (err) => {
          if (err) rejectWithCloseInfo("config send", err);
        });
      }

      // Interhuman wants the recording streamed as small self-contained WebM
      // segments (first carries the header, rest are continuations). The
      // browser's MediaRecorder already cut the blob into valid ~3s segments —
      // we slice at exactly those byte boundaries. This is the reliable path:
      // a server-side EBML parser guessing boundaries trips ih5004. Only when
      // the browser sizes are missing/mismatched do we fall back to parsing.
      const fromBrowser = segmentSizes
        ? framesFromSegmentSizes(bytes, segmentSizes)
        : null;
      const frames = fromBrowser ?? buildWebmFrames(bytes);
      frameInfo = `total=${bytes.byteLength} frames=${frames.length} src=${
        fromBrowser ? "browser" : "parser"
      }`;
      console.log("[analyze-blob] sending", frameInfo);

      const sendFrame = (i: number): void => {
        if (settled) return;
        if (i >= frames.length) {
          // Analysis events don't begin for ~10s after upload. Don't arm the
          // quiet timer yet — wait for the first real event, but bail out if
          // nothing ever arrives.
          warmupTimer = setTimeout(() => {
            if (!settled && !receivedAnalysis) finalize();
          }, WARMUP_TIMEOUT_MS);
          return;
        }
        ws.send(frames[i], { binary: true }, (err) => {
          if (err) {
            rejectWithCloseInfo(`binary send (frame ${i + 1}/${frames.length})`, err);
            return;
          }
          sendFrame(i + 1);
        });
      };
      sendFrame(0);
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
            reject(new Error(`Interhuman error [${code}]: ${message} (${frameInfo})`));
          }
          break;
        }
      }
    });

    ws.on("error", (err) => {
      if (settled) return;
      rejectWithCloseInfo("ws error", err instanceof Error ? err : new Error(String(err)));
    });

    ws.on("close", (code: number, reason: Buffer) => {
      // Record the close frame so a send-failure (EPIPE) reject can report the
      // real upstream cause instead of a bare errno.
      closeCode = code;
      closeReason = reason?.toString() ?? "";
      console.log("[analyze-blob] ws close", { code, reason: closeReason, receivedAnalysis });
      // If upstream closed before we finalized, treat the buffered envelopes
      // as the final result rather than failing.
      if (!settled) finalize();
    });
  });
}
