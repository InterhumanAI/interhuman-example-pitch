"use client";

import {
  compressVideoForUpload,
  type CompressionProgressUpdate,
} from "@/lib/video-compression";
import {
  VERCEL_UPLOAD_MAX_BYTES,
  VERCEL_UPLOAD_MAX_MB,
} from "@/lib/upload-limits";
import { pitchAnalyzeLog } from "@/lib/pitch-analyze-log";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";

export type { PitchAnalyzeApiResponse };
export type { CompressionProgressUpdate };

export type SubmitPitchAnalysisMeta = {
  blob: Blob;
  duration: number;
  mode: string;
  videoId?: string;
  userName?: string;
  questionId?: string;
  onCompressProgress?: (update: CompressionProgressUpdate) => void;
};

function formatSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function handleErrorResponse(
  response: Response,
  uploadBlob: Blob
): Promise<never> {
  let errorBody: { error?: string; errorCode?: string } = {};
  const responseText = await response.text();
  if (responseText) {
    try {
      errorBody = JSON.parse(responseText);
    } catch {
      // Non-JSON error body (e.g. platform 413 page)
    }
  }

  if (response.status === 413 && !errorBody.error) {
    const sizeMB = formatSizeMB(uploadBlob.size);
    errorBody.error = `Upload too large (${sizeMB}MB compressed, limit ${VERCEL_UPLOAD_MAX_MB}MB). Try a shorter recording.`;
    errorBody.errorCode = "UPLOAD_TOO_LARGE";
  }

  if (response.status >= 500 && !errorBody.error) {
    errorBody.error =
      "Server error while analyzing your pitch. If this persists, check that the API is configured.";
  }

  pitchAnalyzeLog.error("Analyze request failed", {
    status: response.status,
    errorCode: errorBody.errorCode,
    message: errorBody.error,
    uploadSize: pitchAnalyzeLog.formatMb(uploadBlob.size),
  });

  throw new Error(errorBody.error || `Failed to analyze pitch (${response.status})`);
}

/**
 * Compress video for Vercel, then analyze via POST /api/pitch/analyze.
 */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta
): Promise<PitchAnalyzeApiResponse> {
  pitchAnalyzeLog.info("Analyze flow started", {
    mode: meta.mode,
    durationSec: meta.duration,
    recordingSize: pitchAnalyzeLog.formatMb(meta.blob.size),
    uploadLimit: pitchAnalyzeLog.formatMb(VERCEL_UPLOAD_MAX_BYTES),
  });

  const compression = await compressVideoForUpload(
    meta.blob,
    meta.onCompressProgress
  );
  const uploadBlob = compression.blob;

  pitchAnalyzeLog.info("Compression finished", {
    skipped: compression.skippedCompression,
    original: pitchAnalyzeLog.formatMb(compression.originalSize),
    final: pitchAnalyzeLog.formatMb(compression.finalSize),
    passes: compression.passes,
  });

  if (uploadBlob.size > VERCEL_UPLOAD_MAX_BYTES) {
    const msg = `Could not compress below ${VERCEL_UPLOAD_MAX_MB}MB (got ${formatSizeMB(uploadBlob.size)}MB after ${compression.passes} passes). Try a shorter recording.`;
    pitchAnalyzeLog.error("Upload blocked — still over limit", {
      size: pitchAnalyzeLog.formatMb(uploadBlob.size),
      passes: compression.passes,
    });
    throw new Error(msg);
  }

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

  pitchAnalyzeLog.info("Uploading to /api/pitch/analyze", {
    videoSize: pitchAnalyzeLog.formatMb(uploadBlob.size),
    mode: meta.mode,
  });

  const uploadStarted = performance.now();
  const response = await fetch("/api/pitch/analyze", {
    method: "POST",
    body: formData,
  });
  const uploadMs = Math.round(performance.now() - uploadStarted);

  if (!response.ok) {
    return handleErrorResponse(response, uploadBlob);
  }

  const data = (await response.json()) as PitchAnalyzeApiResponse;
  pitchAnalyzeLog.info("Analysis complete", {
    uploadMs,
    compositeScore: data.score?.composite,
    savedToLeaderboard: data.savedToLeaderboard ?? false,
  });

  return data;
}
