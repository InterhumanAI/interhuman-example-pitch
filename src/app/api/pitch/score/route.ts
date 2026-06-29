import "server-only";

import { NextResponse } from "next/server";

import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import { buildContentScore } from "@/lib/transcript-scoring";
import { getOpenAIKey } from "@/lib/openai/client";
import type { ContentScore, InterhumanAnalysisResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Below this many characters the transcript is treated as empty/silent and
// content scoring is skipped rather than fed garbage to the LLM. Mirrors the
// threshold in transcribe-pitch.ts.
const MIN_TRANSCRIPT_CHARS = 15;

interface ScorePayload {
  analysis?: InterhumanAnalysisResponse;
  transcript?: string | null;
  duration?: number;
  mode?: string;
  userName?: string | null;
  questionId?: string | null;
}

/**
 * Assemble the final pitch score from an analysis that was streamed live to the
 * proxy in the browser. The delivery analysis is already accumulated client-
 * side, and the proxy already produced a transcript — so unlike /api/pitch/
 * analyze this route does NO upload, NO server-side WebSocket, and NO Whisper
 * call. It just scores the content from the transcript and blends it in.
 */
export async function POST(request: Request) {
  let payload: ScorePayload;
  try {
    payload = (await request.json()) as ScorePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const analysis = payload.analysis;
  if (!analysis || !Array.isArray(analysis.signals)) {
    return NextResponse.json({ error: "analysis required" }, { status: 400 });
  }

  const duration = Number(payload.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "duration required" }, { status: 400 });
  }

  const mode = payload.mode || "free_pitch";

  // Score content directly from the proxy transcript — no transcription step.
  // Graceful degradation: any failure (or no transcript / no key) → delivery-only.
  let content: ContentScore | null = null;
  const transcript = (payload.transcript ?? "").trim();
  const apiKey = getOpenAIKey();
  if (apiKey && transcript.length >= MIN_TRANSCRIPT_CHARS) {
    try {
      content = await buildContentScore({
        transcript,
        durationSeconds: duration,
        mode,
        apiKey,
      });
    } catch (err) {
      console.error("[/api/pitch/score] content scoring failed", err);
    }
  }

  try {
    const result = await completePitchAnalysis({
      analysis,
      duration,
      mode,
      userName: payload.userName ?? null,
      questionId: payload.questionId ?? null,
      content,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/pitch/score] failed", err);
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
