"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import { Video, Square, Circle, RotateCcw, Upload, Save, CheckCircle } from "lucide-react";
import {
  saveVideo,
  generateVideoId,
  generateThumbnail,
  formatStorageSize,
  StoredVideo,
} from "@/lib/video-storage";
import { PitchStreamClient } from "@/lib/interhuman/stream-client";
import type { InterhumanAnalysisResponse } from "@/types";

// Emit a WebM chunk every 3s. Each chunk is streamed live to the Interhuman
// stream-proxy as one binary WS frame (one analysis window) as MediaRecorder
// produces it — no buffering, no server-side re-slicing. A 180s pitch yields
// ~60 windows.
const TIMESLICE_MS = 3000;

interface VideoRecorderProps {
  maxDuration?: number;
  onRecordingComplete: (
    blob: Blob,
    duration: number,
    videoId?: string,
    analysis?: InterhumanAnalysisResponse,
    transcript?: string,
  ) => void;
  mode?: "free" | "challenge";
  pitchMode?: "free_pitch" | "one_minute_challenge" | "qa_practice";
  questionId?: string;
  questionText?: string;
  className?: string;
  autoSave?: boolean;
}

export function VideoRecorder({
  maxDuration = 180,
  onRecordingComplete,
  mode = "free",
  pitchMode = "free_pitch",
  questionId,
  questionText,
  className,
  autoSave = true,
}: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Recorded chunks are kept only to rebuild the local playback/save blob on
  // stop — analysis no longer uses them (each chunk is streamed live instead).
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // Live stream to the Interhuman proxy; assembled analysis + transcript is
  // returned by finish() when recording stops.
  const streamClientRef = useRef<PitchStreamClient | null>(null);
  // The in-flight finalize started on stop; handleSubmit awaits it. Resolves to
  // the assembled analysis + transcript (or null if the stream was never set up).
  const finishPromiseRef = useRef<Promise<{
    analysis: InterhumanAnalysisResponse;
    transcript: string;
  } | null> | null>(null);
  // Latest recorded duration, read inside recorder.onstop to bound the stream.
  const durationRef = useRef(0);
  // Synchronous guard: startRecordingActual is invoked from inside a setState
  // updater, which React StrictMode (dev) runs twice — without this it would
  // mint two sessions and open two WebSockets.
  const startingRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setCameraReady(true);
      setError(null);
    } catch (err) {
      setError("Unable to access camera. Please grant permission and try again.");
      console.error("Camera access error:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration((d) => {
          const newDuration = d + 1;
          durationRef.current = newDuration;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused, maxDuration]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          startRecordingActual();
          return null;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const startRecordingActual = useCallback(async () => {
    if (!streamRef.current) return;
    // Guard against a double-invoke (StrictMode runs the calling setState
    // updater twice). Reset in stop/reset/error paths.
    if (startingRef.current || mediaRecorderRef.current) return;
    startingRef.current = true;

    setSavedVideoId(null);
    setSaveSuccess(false);
    chunksRef.current = [];
    finishPromiseRef.current = null;

    // Open the live analysis stream before recording. If it can't connect
    // (proxy down / bad token), surface the error and don't record — there'd
    // be nothing to analyze.
    const client = new PitchStreamClient();
    try {
      await client.start();
    } catch (err) {
      console.error("Failed to start analysis stream:", err);
      client.abort();
      startingRef.current = false;
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't connect to the analysis service. Please try again.",
      );
      return;
    }
    streamClientRef.current = client;

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      // 1 Mbps is ample for face/voice delivery analysis and keeps each ~3s
      // window small for the live WS frames (see TIMESLICE_MS).
      videoBitsPerSecond: 1000000,
      audioBitsPerSecond: 128000,
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        // Keep for local playback/save, and stream live for analysis.
        chunksRef.current.push(e.data);
        streamClientRef.current?.sendChunk(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType.split(";")[0] });
      setRecordedBlob(blob);
      // MediaRecorder has flushed its final chunk by now, so finalize the
      // stream in the background. handleSubmit awaits this when the user clicks
      // Analyze, so finalize and the user's review overlap.
      const c = streamClientRef.current;
      finishPromiseRef.current = c
        ? c
            .finish(durationRef.current)
            .catch((err) => {
              console.error("Analysis stream finalize failed:", err);
              return null;
            })
            .finally(() => {
              streamClientRef.current = null;
            })
        : Promise.resolve(null);
    };

    recorder.onerror = () => {
      setError("Recording failed. Please try again.");
      setIsRecording(false);
    };

    try {
      recorder.start(TIMESLICE_MS);
      setIsRecording(true);
      setDuration(0);
    } catch (err) {
      console.error("Failed to start recording:", err);
      client.abort();
      streamClientRef.current = null;
      mediaRecorderRef.current = null;
      startingRef.current = false;
      setError("Failed to start recording. Please try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // recorder.onstop kicks off the stream finalize once the last chunk flushes.
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      startingRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setDuration(0);
    durationRef.current = 0;
    setSavedVideoId(null);
    setSaveSuccess(false);
    // Discard any pending/finished stream result from the previous take.
    streamClientRef.current?.abort();
    streamClientRef.current = null;
    finishPromiseRef.current = null;
    mediaRecorderRef.current = null;
    startingRef.current = false;
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, []);

  const saveVideoLocally = useCallback(async () => {
    if (!recordedBlob) return;

    setIsSaving(true);
    try {
      const videoId = generateVideoId();
      let thumbnailUrl: string | undefined;

      try {
        thumbnailUrl = await generateThumbnail(recordedBlob);
      } catch {
        // Thumbnail generation failed, continue without it
      }

      const storedVideo: StoredVideo = {
        id: videoId,
        blob: recordedBlob,
        duration,
        mode: pitchMode,
        questionId,
        questionText,
        createdAt: new Date(),
        analyzed: false,
        thumbnailUrl,
      };

      await saveVideo(storedVideo);
      setSavedVideoId(videoId);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save video:", err);
      setError("Failed to save video locally.");
    } finally {
      setIsSaving(false);
    }
  }, [recordedBlob, duration, pitchMode, questionId, questionText]);

  const handleSubmit = useCallback(async () => {
    if (!recordedBlob) return;

    let videoId = savedVideoId;
    if (autoSave && !videoId) {
      try {
        videoId = generateVideoId();
        let thumbnailUrl: string | undefined;
        try {
          thumbnailUrl = await generateThumbnail(recordedBlob);
        } catch {
          // Continue without thumbnail
        }

        const storedVideo: StoredVideo = {
          id: videoId,
          blob: recordedBlob,
          duration,
          mode: pitchMode,
          questionId,
          questionText,
          createdAt: new Date(),
          analyzed: false,
          thumbnailUrl,
        };
        await saveVideo(storedVideo);
        setSavedVideoId(videoId);
      } catch {
        // Continue even if save fails
      }
    }

    // Wait for the live analysis stream to finalize (started on stop). The
    // promise never rejects — it resolves to null if the stream failed, in
    // which case the page surfaces an error.
    const result = (await finishPromiseRef.current) ?? null;

    onRecordingComplete(
      recordedBlob,
      duration,
      videoId || undefined,
      result?.analysis,
      result?.transcript,
    );
  }, [recordedBlob, duration, onRecordingComplete, autoSave, savedVideoId, pitchMode, questionId, questionText]);

  useEffect(() => {
    if (recordedBlob && videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = URL.createObjectURL(recordedBlob);
      videoRef.current.muted = false;
    }
  }, [recordedBlob]);

  const timeRemaining = maxDuration - duration;
  const isNearEnd = timeRemaining <= 10 && isRecording;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls={!!recordedBlob}
          className="w-full h-full object-cover"
        />

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-8xl font-bold text-white animate-pulse">
              {countdown}
            </span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-white font-mono text-lg bg-black/50 px-2 py-1 rounded">
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {isRecording && mode === "challenge" && (
          <div className="absolute right-4 top-4">
            <span
              className={cn(
                "font-mono text-lg px-3 py-1 rounded",
                isNearEnd
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-black/50 text-white"
              )}
            >
              {formatDuration(timeRemaining)}
            </span>
          </div>
        )}

        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <Video className="w-12 h-12 mx-auto mb-2 animate-pulse" />
              <p>Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white p-4">
              <p className="text-red-400 mb-4">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Video saved locally
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap justify-center">
        {!isRecording && !recordedBlob && (
          <Button
            size="xl"
            onClick={startCountdown}
            disabled={!cameraReady || countdown !== null}
            className="gap-2"
          >
            <Circle className="w-5 h-5 fill-current" />
            {mode === "challenge" ? "Start 1-Minute Challenge" : "Start Recording"}
          </Button>
        )}

        {isRecording && (
          <Button
            size="xl"
            variant="destructive"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="w-5 h-5 fill-current" />
            Stop Recording
          </Button>
        )}

        {recordedBlob && (
          <>
            <Button
              size="lg"
              variant="outline"
              onClick={resetRecording}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Re-record
            </Button>
            {!savedVideoId && (
              <Button
                size="lg"
                variant="outline"
                onClick={saveVideoLocally}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Locally"}
              </Button>
            )}
            <Button
              size="xl"
              onClick={handleSubmit}
              className="gap-2"
            >
              <Upload className="w-5 h-5" />
              Analyze
            </Button>
          </>
        )}
      </div>

      {recordedBlob && (
        <p className="text-sm text-muted-foreground">
          {formatDuration(duration)} • {formatStorageSize(recordedBlob.size)}
          {savedVideoId && " • Saved locally"}
        </p>
      )}

      {mode === "free" && !isRecording && !recordedBlob && (
        <p className="text-sm text-muted-foreground">
          Recommended: 1-3 minutes. Maximum: {formatDuration(maxDuration)}
        </p>
      )}

      {mode === "challenge" && !isRecording && !recordedBlob && (
        <p className="text-sm text-muted-foreground">
          You have exactly 60 seconds. Recording stops automatically.
        </p>
      )}
    </div>
  );
}
