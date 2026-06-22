"use client";

import { uploadInChunks, type UploadAuth } from "@/lib/uploads/multipart-upload";
import { uploadToBlob, type BlobUploadResult } from "@/lib/uploads/blob-client-upload";
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
  /** Optional audio-only blob for transcription / content scoring. */
  audioBlob?: Blob;
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

function makeAudioPathname(mode: string): string {
  const slug = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `pitch-audio/${slug}.webm`;
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

// Whether Vercel Blob is configured server-side. When true we upload
// client-direct (bypasses the 4.5 MB function body limit); when false (local
// dev with no blob token) we fall back to the through-function chunked upload
// against the local-disk store.
let blobConfiguredCache: boolean | null = null;
async function isBlobConfigured(): Promise<boolean> {
  if (blobConfiguredCache !== null) return blobConfiguredCache;
  try {
    const res = await fetch("/api/health");
    const data = (await res.json()) as { hasBlobToken?: boolean };
    blobConfiguredCache = !!data.hasBlobToken;
  } catch {
    blobConfiguredCache = false;
  }
  return blobConfiguredCache;
}

// Upload one blob using whichever path is available. Tries client-direct first
// (production), falling back to chunked-through-function (local dev).
async function uploadOne(
  blob: Blob,
  pathname: string,
  contentType: string,
): Promise<BlobUploadResult> {
  if (await isBlobConfigured()) {
    return uploadToBlob({ blob, pathname, contentType });
  }
  const auth = await signUpload(pathname);
  return uploadInChunks({ blob, auth, contentType });
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
    audioBlob,
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
  let audioBlobUrl: string | undefined;
  let audioPathname: string | undefined;

  if (!videoUrl || !videoPathname) {
    onStreamCallbacks?.onStreaming?.();

    // Upload video and (optional) audio concurrently to avoid serial latency.
    const videoUpload = uploadOne(blob, makePathname(mode), "video/webm");

    const audioUpload = audioBlob
      ? (async () => {
          try {
            return await uploadOne(audioBlob, makeAudioPathname(mode), "audio/webm");
          } catch (err) {
            // Audio is optional — a failure here just means delivery-only scoring.
            console.warn("Audio upload failed, continuing without content score:", err);
            return null;
          }
        })()
      : Promise.resolve(null);

    const [uploadedVideo, uploadedAudio] = await Promise.all([
      videoUpload,
      audioUpload,
    ]);
    videoUrl = uploadedVideo.url;
    videoPathname = uploadedVideo.pathname;
    if (uploadedAudio) {
      audioBlobUrl = uploadedAudio.url;
      audioPathname = uploadedAudio.pathname;
    }
  }

  onStreamCallbacks?.onConnecting?.();

  const res = await fetch("/api/pitch/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blobUrl: videoUrl,
      videoPathname,
      audioBlobUrl: audioBlobUrl ?? null,
      audioPathname: audioPathname ?? null,
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
