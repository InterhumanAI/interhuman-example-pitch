import "server-only";

import type { ContentScore } from "@/types";
import { getOpenAIKey, transcribeAudio } from "@/lib/openai/client";
import { buildContentScore } from "@/lib/transcript-scoring";

const TRANSCRIBE_MODEL = "whisper-1";
// Below this many characters the transcript is treated as empty/silent and
// content scoring is skipped rather than fed garbage to the LLM.
const MIN_TRANSCRIPT_CHARS = 15;

/**
 * Single graceful-degradation boundary for content scoring. Transcribes the
 * audio, then scores its content. Returns null (never throws) if OpenAI isn't
 * configured, the transcript is empty/too short, or anything fails — so the
 * delivery-only path is never broken by a content failure.
 */
export async function analyzeContentFromAudio(args: {
  audioBytes: Uint8Array;
  audioContentType: string;
  durationSeconds: number;
  mode: string;
}): Promise<ContentScore | null> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    return null;
  }

  try {
    const { text } = await transcribeAudio({
      bytes: args.audioBytes,
      filename: "pitch.webm",
      contentType: args.audioContentType,
      apiKey,
      model: TRANSCRIBE_MODEL,
    });

    const transcript = text.trim();
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      console.warn(
        "[transcribe-pitch] transcript too short, skipping content score",
      );
      return null;
    }

    return await buildContentScore({
      transcript,
      durationSeconds: args.durationSeconds,
      mode: args.mode,
      apiKey,
    });
  } catch (err) {
    console.error("[transcribe-pitch] content scoring failed", err);
    return null;
  }
}
