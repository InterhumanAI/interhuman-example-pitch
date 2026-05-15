"use client";

import { compressVideoForUpload } from "@/lib/video-compression";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";

export type { PitchAnalyzeApiResponse };

export type SubmitPitchAnalysisMeta = {
  blob: Blob;
  duration: number;
  mode: string;
  videoId?: string;
  userName?: string;
  questionId?: string;
  onCompressProgress?: (progress: number) => void;
};

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

  if (response.status === 413 && !errorBody.error) {
    const sizeMB = (uploadBlob.size / (1024 * 1024)).toFixed(2);
    errorBody.error = `Upload too large (${sizeMB}MB) after compression. Try a shorter recording.`;
    errorBody.errorCode = "UPLOAD_TOO_LARGE";
  }

  throw new Error(errorBody.error || "Failed to analyze pitch");
}

/**
 * Compress video for Vercel, then analyze via POST /api/pitch/analyze.
 */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta
): Promise<PitchAnalyzeApiResponse> {
  const uploadBlob = await compressVideoForUpload(
    meta.blob,
    meta.onCompressProgress
  );

  const formData = new FormData();
  formData.append("video", uploadBlob, "pitch.webm");
  formData.append("duration", meta.duration.toString());
  formData.append("mode", meta.mode);
  if (meta.userName?.trim()) {
    formData.append("userName", meta.userName.trim());
  }
  if (meta.questionId) {
    formData.append("questionId", meta.questionId);
  }

  const response = await fetch("/api/pitch/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    return handleErrorResponse(response, uploadBlob);
  }

  return response.json() as Promise<PitchAnalyzeApiResponse>;
}
