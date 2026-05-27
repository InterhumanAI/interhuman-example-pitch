"use client";

import { InterhumanStream } from "@/lib/interhuman-stream";
import { calculatePitchScore } from "@/lib/scoring";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";
import type { SignalEntry, EngagementStateEntry } from "@/types";

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
  onCompressProgress?: (update: unknown) => void; // kept for interface compat
};

const SEGMENT_DURATION_MS = 3000;

/**
 * Stream the recorded video to Interhuman via WebSocket, bypassing Vercel's
 * 4.5MB body limit entirely. The video is split into 3-second segments and
 * sent directly from the browser to Interhuman's streaming endpoint.
 */
export async function submitPitchAnalysis(
  meta: SubmitPitchAnalysisMeta
): Promise<PitchAnalyzeApiResponse> {
  const { blob, duration, mode, userName, questionId, onStreamCallbacks } = meta;

  onStreamCallbacks?.onConnecting?.();

  const stream = new InterhumanStream({
    onSignal: (signals) => onStreamCallbacks?.onSignal?.(signals),
    onEngagement: (entry) => onStreamCallbacks?.onEngagement?.(entry),
    onError: (code, message) => {
      console.error(`Interhuman stream error [${code}]: ${message}`);
      onStreamCallbacks?.onError?.(message);
    },
  });

  await stream.connect({
    include: ["conversation_quality_overall", "conversation_quality_timeline"],
  });

  onStreamCallbacks?.onStreaming?.();

  await streamBlobAsSegments(blob, stream, SEGMENT_DURATION_MS);

  // Wait briefly for any trailing server events before closing
  await new Promise((resolve) => setTimeout(resolve, 2000));

  stream.close();

  onStreamCallbacks?.onProcessing?.();

  const analysis = stream.getAccumulatedResults();
  const scoreWithoutPercentile = calculatePitchScore(analysis, duration);
  const score = { ...scoreWithoutPercentile, percentile: 50 };

  // Save results to the server (lightweight JSON, well under 4.5MB)
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
 * Re-record a blob into WebM segments and send them to the streaming endpoint.
 * Uses MediaRecorder to produce proper WebM chunks that Interhuman can decode.
 */
async function streamBlobAsSegments(
  blob: Blob,
  stream: InterhumanStream,
  segmentMs: number
): Promise<void> {
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
        // Continue without audio if not available
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

      recorder.start(segmentMs);
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
