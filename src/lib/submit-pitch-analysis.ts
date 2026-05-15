"use client";

import { analyzeVideoDirect } from "@/lib/interhuman-client";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-limits";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";

export type { PitchAnalyzeApiResponse };

export type SubmitPitchAnalysisMeta = {
  blob: Blob;
  duration: number;
  mode: string;
  videoId?: string;
  userName?: string;
  questionId?: string;
};

function assertUploadSize(blob: Blob): void {
  if (blob.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB. Please record a shorter video.`
    );
  }
}

async function handleErrorResponse(
  response: Response,
  uploadBlob: Blob
): Promise<never> {
  let errorBody: { error?: string; errorCode?: string } = {};
  const responseText = await response.text();
  try {
    errorBody = JSON.parse(responseText);
  } catch {
    // Non-JSON error body (e.g. platform 413 page)
  }

  const sizeMB = (uploadBlob.size / (1024 * 1024)).toFixed(2);

  if (response.status === 413 && !errorBody.error) {
    errorBody.error = `Upload too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`;
    errorBody.errorCode = "UPLOAD_TOO_LARGE";
  }

  throw new Error(errorBody.error || "Failed to analyze pitch");
}

/** Analyze a pitch video (up to 32MB) via direct browser upload to Interhuman. */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta
): Promise<PitchAnalyzeApiResponse> {
  assertUploadSize(meta.blob);

  const tokenResponse = await fetch("/api/pitch/token", { method: "POST" });
  if (!tokenResponse.ok) {
    const err = await tokenResponse.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || "Failed to authorize video upload"
    );
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };
  const analysis = await analyzeVideoDirect(meta.blob, access_token);

  const completeResponse = await fetch("/api/pitch/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis,
      duration: meta.duration,
      mode: meta.mode,
      userName: meta.userName?.trim() || null,
      questionId: meta.questionId || null,
    }),
  });

  if (!completeResponse.ok) {
    return handleErrorResponse(completeResponse, meta.blob);
  }

  return completeResponse.json() as Promise<PitchAnalyzeApiResponse>;
}
