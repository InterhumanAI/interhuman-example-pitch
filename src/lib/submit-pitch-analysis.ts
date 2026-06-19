"use client";

import { InterhumanStream } from "@/lib/interhuman-stream";
import { uploadInChunks } from "@/lib/uploads/multipart-upload";
import { calculatePitchScore } from "@/lib/scoring";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";
import type {
  InterhumanAnalysisResponse,
  SignalEntry,
  EngagementStateEntry,
} from "@/types";

export type { PitchAnalyzeApiResponse };

export type StreamingAnalysisCallbacks = {
  onConnecting?: () => void;
  onStreaming?: () => void;
  onSignal?: (signals: SignalEntry[]) => void;
  onEngagement?: (entry: EngagementStateEntry) => void;
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

/**
 * Analyze a saved/recorded video blob via the server-side Interhuman relay.
 *
 * No part of this path ships INTERHUMAN_API_KEY or BLOB_READ_WRITE_TOKEN to
 * the browser. Streaming and Vercel Blob uploads share the same opaque
 * session token issued by `/api/stream/start`.
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

  const stream = new InterhumanStream({
    onSignal: (signals) => onStreamCallbacks?.onSignal?.(signals),
    onEngagement: (entry) => onStreamCallbacks?.onEngagement?.(entry),
    onError: (code, message) => {
      console.error(`Interhuman stream error [${code}]: ${message}`);
      onStreamCallbacks?.onError?.(message);
    },
  });

  onStreamCallbacks?.onConnecting?.();
  await stream.connect({
    include: ["conversation_quality_overall", "conversation_quality_timeline"],
  });

  onStreamCallbacks?.onStreaming?.();

  // Run the relay stream and the durable Blob upload in parallel — neither
  // depends on the other and the user shouldn't pay for them sequentially.
  const auth = stream.getAuth();
  const uploadPromise: Promise<{ url: string; pathname: string } | null> =
    uploadedVideoUrl && uploadedVideoPathname
      ? Promise.resolve({ url: uploadedVideoUrl, pathname: uploadedVideoPathname })
      : auth
        ? uploadInChunks({
            blob,
            pathname: `pitches/${mode}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}.webm`,
            streamSessionId: auth.sessionId,
            streamToken: auth.token,
            contentType: "video/webm",
          }).catch((err) => {
            console.warn("Multipart upload failed:", err);
            return null;
          })
        : Promise.resolve(null);

  await streamBlobThroughRelay(blob, stream);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  stream.close();

  const analysis = stream.getAccumulatedResults();

  onStreamCallbacks?.onProcessing?.();

  const scoreWithoutPercentile = calculatePitchScore(analysis, duration);
  const score = { ...scoreWithoutPercentile, percentile: 50 };

  const uploaded = await uploadPromise;
  const videoUrl = uploaded?.url ?? null;
  const videoPathname = uploaded?.pathname ?? null;

  let pitchId: string | null = null;
  let scoreId: string | null = null;
  let savedToLeaderboard = false;

  try {
    const saveResponse = await fetch("/api/pitch/save-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis,
        score,
        duration,
        mode,
        userName: userName || null,
        questionId: questionId || null,
        videoUrl,
        videoPathname,
      }),
    });

    if (saveResponse.ok) {
      const saveData = await saveResponse.json();
      pitchId = saveData.pitchId || null;
      scoreId = saveData.scoreId || null;
      savedToLeaderboard = saveData.savedToLeaderboard || false;
      if (saveData.percentile != null) {
        score.percentile = saveData.percentile;
      }
    }
  } catch {
    // Non-critical: results are already computed client-side
  }

  return {
    analysis,
    score,
    mode,
    duration,
    pitchId,
    scoreId,
    savedToLeaderboard,
  };
}

/**
 * Re-encode a saved blob into fresh MediaRecorder segments and forward them
 * through the Interhuman relay. Each segment is decodable on its own (the
 * stream client lazily extracts and re-prepends the WebM init segment on the
 * client side, then the relay forwards to the upstream WS).
 */
async function streamBlobThroughRelay(
  blob: Blob,
  stream: InterhumanStream,
): Promise<void> {
  const SEGMENT_MS = 3000;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const objectUrl = URL.createObjectURL(blob);

    let audioCtx: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
      if (audioCtx) {
        void audioCtx.close();
        audioCtx = null;
      }
    };

    const startStreaming = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Could not create canvas context"));
        return;
      }

      const fps = 30;
      const canvasStream = canvas.captureStream(fps);

      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioCtx.destination);
        const audioTrack = destination.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      } catch {
        // Continue without audio
      }

      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

      recorder = new MediaRecorder(canvasStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && stream.isConnected) {
          void stream.sendSegment(e.data);
        }
      };

      recorder.onstop = () => {
        cleanup();
        resolve();
      };

      let animationFrameId: number | null = null;
      const drawFrame = () => {
        if (video.paused || video.ended) {
          if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        }
      };

      recorder.start(SEGMENT_MS);
      video.play().then(drawFrame).catch((err) => {
        cleanup();
        reject(err);
      });
    };

    video.onloadeddata = () => startStreaming();
    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for streaming"));
    };

    video.src = objectUrl;
  });
}
