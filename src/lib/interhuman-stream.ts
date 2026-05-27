"use client";

import type {
  InterhumanAnalysisResponse,
  SignalEntry,
  EngagementStateEntry,
  ConversationQualityValues,
  TimelineEntry,
} from "@/types";

const WS_URL = "wss://api.interhuman.ai/v1/stream/analyze";

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

export class InterhumanStream {
  private ws: WebSocket | null = null;
  private signals: SignalEntry[] = [];
  private engagementStates: EngagementStateEntry[] = [];
  private conversationQuality: {
    overall?: ConversationQualityValues;
    timeline: TimelineEntry[];
  } = { timeline: [] };
  private callbacks: InterhumanStreamCallbacks;
  private sessionConfigSent = false;

  constructor(callbacks: InterhumanStreamCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async connect(config?: StreamSessionConfig): Promise<void> {
    const tokenResponse = await fetch("/api/pitch/ws-token");
    if (!tokenResponse.ok) {
      throw new Error("Failed to obtain streaming token");
    }
    const { token } = await tokenResponse.json();

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL, token);
      } catch (err) {
        reject(new Error(`WebSocket creation failed: ${err}`));
        return;
      }
      this.ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error("WebSocket connection timed out (5s)"));
        }
      }, 5000);

      this.ws.addEventListener("open", () => {
        clearTimeout(timeout);
        const sessionConfig = config || {
          include: [
            "conversation_quality_overall",
            "conversation_quality_timeline",
          ],
        };
        this.ws!.send(JSON.stringify(sessionConfig));
        this.sessionConfigSent = true;
        this.callbacks.onOpen?.();
        resolve();
      });

      this.ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        this.handleMessage(event.data);
      });

      this.ws.addEventListener("error", (event) => {
        clearTimeout(timeout);
        console.error("WebSocket error event:", event);
        reject(new Error("WebSocket connection failed — check API key streaming access"));
      });

      this.ws.addEventListener("close", (event) => {
        clearTimeout(timeout);
        if (!this.sessionConfigSent) {
          reject(new Error(
            `WebSocket closed before session started (code: ${event.code}, reason: ${event.reason || "none"})`
          ));
        }
        this.callbacks.onClose?.();
      });
    });
  }

  private handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw);
      const { type, data } = payload;

      switch (type) {
        case "signal.detected":
          if (data?.signals) {
            this.signals.push(...data.signals);
            this.callbacks.onSignal?.(data.signals);
          }
          break;

        case "engagement.updated":
          if (data) {
            const entry: EngagementStateEntry = {
              state: data.state,
              start: data.start,
              end: data.end,
            };
            this.engagementStates.push(entry);
            this.callbacks.onEngagement?.(entry);
          }
          break;

        case "conversation_quality.updated":
          if (data?.overall) {
            this.conversationQuality.overall = data.overall;
          }
          if (data?.timeline) {
            this.conversationQuality.timeline.push(...data.timeline);
          }
          this.callbacks.onConversationQuality?.({
            overall: data?.overall,
            timeline: data?.timeline,
          });
          break;

        case "error":
          this.callbacks.onError?.(
            data?.code || "unknown",
            data?.message || "Unknown streaming error"
          );
          break;
      }
    } catch {
      // Ignore unparseable messages
    }
  }

  sendSegment(buffer: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.sessionConfigSent) {
      this.ws.send(buffer);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getAccumulatedResults(): InterhumanAnalysisResponse {
    return {
      signals: this.signals,
      engagement_state: this.engagementStates,
      conversation_quality:
        this.conversationQuality.overall || this.conversationQuality.timeline.length > 0
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
    this.sessionConfigSent = false;
  }
}
