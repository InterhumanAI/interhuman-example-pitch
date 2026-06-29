"use client";

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

/**
 * Browser-side client for live-streaming a recording to the Interhuman
 * stream-proxy. The browser sends each MediaRecorder chunk up as a binary WS
 * frame *as it is produced* — no buffering, no server-side re-slicing — which
 * avoids the malformed/truncated (ih5004) errors the old record-then-replay
 * path produced by guessing Cluster boundaries.
 *
 * Flow:
 *   1. start()      → mint a session, open the WS, await demo.connection.established
 *   2. sendChunk()  → ws.send(blob) for each MediaRecorder dataavailable
 *   3. finish()     → flush, await finalize, return the accumulated analysis
 *
 * Analysis events stream back as JSON. We accumulate them into the same
 * InterhumanAnalysisResponse shape the results UI already consumes (the
 * accumulation mirrors the server-side logic in analyze-blob.ts), plus the
 * running transcript assembled from demo.transcript.updated windows.
 */

const CONNECT_TIMEOUT_MS = 12_000;
// Quiet window after the last analysis event before we consider the stream
// done. Shorter than the server path's 20s because events stream throughout
// the recording here — by the time the user stops, most analysis is already in.
const FINALIZE_QUIET_MS = 10_000;
// Hard cap on how long finish() waits for finalize after the user stops.
const FINALIZE_HARD_MS = 60_000;

export interface StreamResult {
  analysis: InterhumanAnalysisResponse;
  transcript: string;
}

interface MintedSession {
  sessionId: string;
  wsUrl: string;
  token: string;
  expiresAt: string;
}

type ParsedEvent = {
  type?: string;
  data?: Record<string, unknown>;
  // demo.* events carry their fields at the top level rather than under `data`.
  [key: string]: unknown;
};

export class PitchStreamClient {
  private ws: WebSocket | null = null;
  private established = false;
  private closed = false;
  private closeInfo: { code: number; reason: string } | null = null;

  // Accumulated analysis state — mirrors analyze-blob.ts.
  private readonly signals: SignalEntry[] = [];
  private readonly openSignals = new Map<
    SignalType,
    { start: number; probability: SignalProbability; rationale: string }
  >();
  private readonly engagementStates: EngagementStateEntry[] = [];
  private readonly quality: {
    overall?: ConversationQualityValues;
    timeline: TimelineEntry[];
  } = { timeline: [] };

  // Transcript windows keyed by index so out-of-order arrivals still join in
  // the right order.
  private readonly transcriptWindows = new Map<number, string>();
  private transcriptFallback = "";

  private lastEventAt = 0;
  private receivedAnalysis = false;

  /** Open the proxy socket and resolve once the proxy confirms the session. */
  async start(): Promise<void> {
    const session = await this.mintSession();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const connectTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.teardown();
        reject(new Error("Timed out connecting to the analysis stream"));
      }, CONNECT_TIMEOUT_MS);

      // The token rides as the first (and only) subprotocol value.
      const ws = new WebSocket(session.wsUrl, [session.token]);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onmessage = (e) => this.handleMessage(e);

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        reject(new Error("Analysis stream connection error"));
      };

      ws.onclose = (e) => {
        this.closed = true;
        this.closeInfo = { code: e.code, reason: e.reason };
        if (!settled) {
          settled = true;
          clearTimeout(connectTimer);
          reject(new Error(this.describeClose(e.code, e.reason)));
        }
      };

      // Resolve as soon as the proxy says the session is live. demo.* handling
      // sets `established`; poll it from the message handler via a callback.
      this.onEstablished = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        resolve();
      };
    });
  }

  private onEstablished: (() => void) | null = null;

  /** Send one MediaRecorder chunk as a binary frame (one analysis window). */
  sendChunk(blob: Blob): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(blob);
    }
  }

  /**
   * Flush the final window and wait for the stream to go quiet, then return the
   * accumulated analysis. Closes the socket before resolving.
   */
  async finish(durationSeconds: number): Promise<StreamResult> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "demo.flush" }));
      } catch {
        /* noop — finalize on quiet/close regardless */
      }
    }

    await this.waitForQuiet();
    this.teardown();
    return this.buildResult(durationSeconds);
  }

  /** Tear down the socket without waiting (e.g. on a failed start). */
  abort(): void {
    this.teardown();
  }

  private async mintSession(): Promise<MintedSession> {
    const res = await fetch("/api/stream/session", { method: "POST" });
    if (!res.ok) {
      let message = `Failed to start analysis session (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* keep default */
      }
      throw new Error(message);
    }
    return (await res.json()) as MintedSession;
  }

  private handleMessage(e: MessageEvent): void {
    // Media flows up only; everything down is JSON text.
    if (typeof e.data !== "string") return;

    let parsed: ParsedEvent | null = null;
    try {
      parsed = JSON.parse(e.data) as ParsedEvent;
    } catch {
      return;
    }
    if (!parsed || typeof parsed.type !== "string") return;

    this.lastEventAt = Date.now();
    const { type } = parsed;
    // Most upstream Interhuman envelopes nest their fields under `data`; demo.*
    // events put them at the top level. Fall back to the event itself.
    const data = (parsed.data as Record<string, unknown> | undefined) ?? parsed;

    switch (type) {
      case "demo.connection.established": {
        this.established = true;
        this.onEstablished?.();
        break;
      }

      // Proxy-wrapped signal: { signal: { type, start, end, probability, rationale } }
      case "demo.signal.detected": {
        const signal = (data?.signal ?? parsed.signal) as
          | Record<string, unknown>
          | undefined;
        if (signal) {
          const signalType = signal.type as SignalType | undefined;
          if (signalType) {
            this.signals.push({
              type: signalType,
              start: (signal.start as number) ?? 0,
              end: (signal.end as number) ?? (signal.start as number) ?? 0,
              probability: (signal.probability as SignalProbability) ?? "medium",
              rationale: (signal.rationale as string) ?? "",
            });
          }
        }
        this.noteAnalysisEvent();
        break;
      }

      case "demo.transcript.updated": {
        const index = Number(data?.index ?? parsed.index);
        const text = (data?.text as string) ?? (parsed.text as string) ?? "";
        if (Number.isFinite(index)) {
          this.transcriptWindows.set(index, text);
        } else if (text) {
          this.transcriptFallback += (this.transcriptFallback ? " " : "") + text;
        }
        this.noteAnalysisEvent();
        break;
      }

      // Raw upstream Interhuman envelopes (forwarded verbatim by the proxy).
      case "signal.detected": {
        const signalType = data?.signal_type as SignalType | undefined;
        if (signalType) {
          this.openSignals.set(signalType, {
            start: (data?.start as number) ?? 0,
            probability: (data?.probability as SignalProbability) ?? "medium",
            rationale: (data?.rationale as string) ?? "",
          });
        }
        this.noteAnalysisEvent();
        break;
      }

      case "signal.ended": {
        const signalType = data?.signal_type as SignalType | undefined;
        if (signalType && this.openSignals.has(signalType)) {
          const open = this.openSignals.get(signalType)!;
          this.signals.push({
            type: signalType,
            start: open.start,
            end: (data?.end as number) ?? open.start,
            probability: open.probability,
            rationale: open.rationale,
          });
          this.openSignals.delete(signalType);
        }
        this.noteAnalysisEvent();
        break;
      }

      case "engagement.updated": {
        if (data) {
          this.engagementStates.push({
            state: data.state as EngagementState,
            start: data.start as number,
            end: data.end as number,
          });
        }
        this.noteAnalysisEvent();
        break;
      }

      case "conversation_quality.updated": {
        const overall = data?.overall as ConversationQualityValues | undefined;
        const timeline = data?.timeline as TimelineEntry[] | undefined;
        if (overall) this.quality.overall = overall;
        if (Array.isArray(timeline) && timeline.length) {
          this.quality.timeline.push(...timeline);
        }
        this.noteAnalysisEvent();
        break;
      }

      case "error": {
        const message = (data?.message as string) ?? "Upstream analysis error";
        const code = (data?.code as string) ?? "unknown";
        // Surface via close so finish()/start() reject with a useful message.
        this.closeInfo = { code: 1011, reason: `[${code}] ${message}` };
        this.teardown();
        break;
      }

      // demo.window.status, demo.connection.closed, session.ready, and any
      // unrecognized type are informational here — they still count as activity
      // for the quiet timer but don't change accumulated state.
      default: {
        if (type.startsWith("demo.") || type === "session.ready") {
          // keep-alive style; don't mark as analysis so a stream that only ever
          // sends status never blocks finalize prematurely.
        }
        break;
      }
    }
  }

  private noteAnalysisEvent(): void {
    this.receivedAnalysis = true;
  }

  private waitForQuiet(): Promise<void> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        if (this.closed) return resolve();
        const sinceLast = Date.now() - this.lastEventAt;
        const totalWaited = Date.now() - startedAt;
        // Finalize once the stream has been quiet long enough, or we hit the
        // hard cap. If no analysis ever arrived, the quiet window from t=0 still
        // elapses and we resolve with an empty (delivery-fallback) analysis.
        if (
          (this.receivedAnalysis && sinceLast >= FINALIZE_QUIET_MS) ||
          totalWaited >= FINALIZE_HARD_MS ||
          (!this.receivedAnalysis && totalWaited >= FINALIZE_QUIET_MS)
        ) {
          return resolve();
        }
        setTimeout(tick, 500);
      };
      tick();
    });
  }

  private buildResult(durationSeconds: number): StreamResult {
    // Close out any signals that never received an end (still active at stop).
    this.openSignals.forEach((open, type) => {
      const fallbackEnd =
        durationSeconds && durationSeconds > open.start
          ? durationSeconds
          : open.start + 1;
      this.signals.push({
        type,
        start: open.start,
        end: fallbackEnd,
        probability: open.probability,
        rationale: open.rationale,
      });
    });
    this.openSignals.clear();

    const analysis: InterhumanAnalysisResponse = {
      signals: this.signals,
      engagement_state: this.engagementStates,
      conversation_quality:
        this.quality.overall || this.quality.timeline.length > 0
          ? {
              overall:
                this.quality.overall ?? {
                  quality_index: 50,
                  energy: 50,
                  rapport: 50,
                  authority: 50,
                  learning: 50,
                  clarity: 50,
                },
              timeline: this.quality.timeline,
            }
          : undefined,
    };

    return { analysis, transcript: this.assembleTranscript() };
  }

  private assembleTranscript(): string {
    if (this.transcriptWindows.size > 0) {
      return Array.from(this.transcriptWindows.keys())
        .sort((a, b) => a - b)
        .map((i) => this.transcriptWindows.get(i)!.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    return this.transcriptFallback.trim();
  }

  private describeClose(code: number, reason: string): string {
    if (code === 401) {
      return "Analysis stream rejected the session (auth). Please try again.";
    }
    if (code === 1008) {
      return "Recording exceeded the maximum analysis duration.";
    }
    if (code === 1011) {
      return reason
        ? `Analysis stream closed: ${reason}`
        : "The analysis service closed the connection.";
    }
    return reason ? `Analysis stream closed (${code}): ${reason}` : `Analysis stream closed (${code})`;
  }

  private teardown(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
    this.closed = true;
  }
}
