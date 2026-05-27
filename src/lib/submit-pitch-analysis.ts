"use client";

import { InterhumanStream } from "@/lib/interhuman-stream";
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
  onStreamCallbacks?: StreamingAnalysisCallbacks;
  onCompressProgress?: (update: unknown) => void;
};

/**
 * Analyze video by uploading directly from the browser to Interhuman,
 * bypassing Vercel's 4.5MB serverless function body limit entirely.
 *
 * Strategy:
 * 1. Try WebSocket streaming (real-time, best UX)
 * 2. Fall back to direct REST upload to Interhuman from browser
 */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta
): Promise<PitchAnalyzeApiResponse> {
  const { blob, duration, mode, userName, questionId, onStreamCallbacks } = meta;

  let analysis: InterhumanAnalysisResponse;

  try {
    analysis = await analyzeViaWebSocket(blob, onStreamCallbacks);
  } catch (wsError) {
    console.warn("WebSocket streaming unavailable, falling back to direct upload:", wsError);
    analysis = await analyzeViaDirectUpload(blob, onStreamCallbacks);
  }

  onStreamCallbacks?.onProcessing?.();

  const scoreWithoutPercentile = calculatePitchScore(analysis, duration);
  const score = { ...scoreWithoutPercentile, percentile: 50 };

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
 * Primary path: stream video segments over WebSocket for real-time analysis.
 */
async function analyzeViaWebSocket(
  blob: Blob,
  callbacks?: StreamingAnalysisCallbacks
): Promise<InterhumanAnalysisResponse> {
  callbacks?.onConnecting?.();

  const stream = new InterhumanStream({
    onSignal: (signals) => callbacks?.onSignal?.(signals),
    onEngagement: (entry) => callbacks?.onEngagement?.(entry),
    onError: (code, message) => {
      console.error(`Interhuman stream error [${code}]: ${message}`);
    },
  });

  await stream.connect({
    include: ["conversation_quality_overall", "conversation_quality_timeline"],
  });

  callbacks?.onStreaming?.();

  await streamBlobAsSegments(blob, stream);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  stream.close();

  return stream.getAccumulatedResults();
}

/**
 * Fallback: upload the video directly from the browser to Interhuman's
 * REST endpoint. Still bypasses Vercel (browser → Interhuman, up to 32MB).
 */
async function analyzeViaDirectUpload(
  blob: Blob,
  callbacks?: StreamingAnalysisCallbacks
): Promise<InterhumanAnalysisResponse> {
  callbacks?.onConnecting?.();

  const tokenResponse = await fetch("/api/pitch/ws-token");
  if (!tokenResponse.ok) {
    throw new Error("Failed to obtain API token");
  }
  const { token } = await tokenResponse.json();

  callbacks?.onStreaming?.();

  const formData = new FormData();
  formData.append("file", blob, "pitch.webm");
  formData.append("include[]", "conversation_quality_overall");
  formData.append("include[]", "conversation_quality_timeline");

  const response = await fetch("https://api.interhuman.ai/v1/upload/analyze", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Analysis failed (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.message) message = errJson.message;
    } catch {
      // use default message
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Re-record a blob into WebM segments and send them to the streaming endpoint.
 */
async function streamBlobAsSegments(
  blob: Blob,
  stream: InterhumanStream
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

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && stream.isConnected) {
          const buffer = await e.data.arrayBuffer();
          stream.sendSegment(buffer);
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
