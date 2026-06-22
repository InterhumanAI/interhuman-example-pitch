"use client";

import { uploadInChunks, type UploadAuth } from "@/lib/uploads/multipart-upload";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";

export type { PitchAnalyzeApiResponse };

export type StreamingAnalysisCallbacks = {
  onConnecting?: () => void;
  onStreaming?: () => void;
  onProcessing?: () => void;
  onError?: (message: string) => void;
};

export type SubmitPitchAnalysisMeta = {
  blob: Blob;
  duration: number;
  mode: string;
  videoId?: string;
  userName?: string;
  questionId?: string;
  /** If the recorder already uploaded the blob, skip the multipart re-upload. */
  uploadedVideoUrl?: string;
  uploadedVideoPathname?: string;
  onStreamCallbacks?: StreamingAnalysisCallbacks;
};

function makePathname(mode: string): string {
  const slug = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `pitches/${slug}.webm`;
}

async function signUpload(pathname: string): Promise<UploadAuth> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pathname }),
  });
  if (!res.ok) {
    throw new Error(`Failed to sign upload (${res.status})`);
  }
  const data = (await res.json()) as {
    pathname: string;
    expires: number;
    signature: string;
  };
  return {
    token: data.signature,
    expires: data.expires,
    pathname: data.pathname,
  };
}

/**
 * Upload the recorded pitch to Vercel Blob, then ask the server to analyze it
 * by opening a single WebSocket to Interhuman. All state lives inside one
 * request, so this works on serverless without any cross-invocation tricks.
 */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta,
): Promise<PitchAnalyzeApiResponse> {
  const {
    blob,
    duration,
    mode,
    userName,
    questionId,
    uploadedVideoUrl,
    uploadedVideoPathname,
    onStreamCallbacks,
  } = meta;

  let videoUrl = uploadedVideoUrl;
  let videoPathname = uploadedVideoPathname;

  if (!videoUrl || !videoPathname) {
    onStreamCallbacks?.onStreaming?.();
    const pathname = makePathname(mode);
    const auth = await signUpload(pathname);
    const uploaded = await uploadInChunks({
      blob,
      auth,
      contentType: "video/webm",
    });
    videoUrl = uploaded.url;
    videoPathname = uploaded.pathname;
  }

  onStreamCallbacks?.onConnecting?.();

  const res = await fetch("/api/pitch/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blobUrl: videoUrl,
      videoPathname,
      duration,
      mode,
      userName: userName ?? null,
      questionId: questionId ?? null,
    }),
  });

  onStreamCallbacks?.onProcessing?.();

  if (!res.ok) {
    let message = `Analysis failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    onStreamCallbacks?.onError?.(message);
    throw new Error(message);
  }

  return (await res.json()) as PitchAnalyzeApiResponse;
}
