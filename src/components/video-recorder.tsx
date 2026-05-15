"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import { Video, Square, Circle, RotateCcw, Upload, AlertTriangle, Save, CheckCircle } from "lucide-react";
import { ResizingMediaRecorder, COMPRESSION_PRESETS } from "@/lib/video-compression";
import {
  saveVideo,
  generateVideoId,
  generateThumbnail,
  formatStorageSize,
  StoredVideo,
} from "@/lib/video-storage";

import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-limits";

interface VideoRecorderProps {
  maxDuration?: number;
  onRecordingComplete: (blob: Blob, duration: number, videoId?: string) => void;
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
  const resizingRecorderRef = useRef<ResizingMediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSizeWarning, setFileSizeWarning] = useState<string | null>(null);
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

    setFileSizeWarning(null);
    setSavedVideoId(null);
    setSaveSuccess(false);

    // Use resizing recorder for on-the-fly compression
    const recorder = new ResizingMediaRecorder(COMPRESSION_PRESETS.aggressive);
    resizingRecorderRef.current = recorder;

    recorder.onstop = (blob) => {
      setRecordedBlob(blob);

      if (blob.size > MAX_UPLOAD_SIZE_BYTES) {
        setFileSizeWarning(
          `Video is ${formatStorageSize(blob.size)} (max ${MAX_UPLOAD_SIZE_MB}MB). Please record a shorter video.`
        );
      } else if (blob.size > MAX_UPLOAD_SIZE_BYTES * 0.8) {
        setFileSizeWarning(
          `Video is ${formatStorageSize(blob.size)}. Close to the ${MAX_UPLOAD_SIZE_MB}MB limit.`
        );
      }
    };

    recorder.onerror = (err) => {
      console.error("Recording error:", err);
      setError("Recording failed. Please try again.");
      setIsRecording(false);
    };

    try {
      await recorder.start(streamRef.current);
      setIsRecording(true);
      setDuration(0);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Failed to start recording. Please try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (resizingRecorderRef.current && isRecording) {
      resizingRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setDuration(0);
    setFileSizeWarning(null);
    setSavedVideoId(null);
    setSaveSuccess(false);
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

      // Reset success indicator after 3 seconds
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

    if (recordedBlob.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(
        `Video file is too large (${formatStorageSize(recordedBlob.size)}). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB. Please record a shorter video.`
      );
      return;
    }

    // Auto-save before submitting if enabled and not already saved
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

    onRecordingComplete(recordedBlob, duration, videoId || undefined);
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
  const isFileTooLarge = !!(recordedBlob && recordedBlob.size > MAX_UPLOAD_SIZE_BYTES);

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
          <div className="absolute top-4 right-4">
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

      {fileSizeWarning && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm",
            isFileTooLarge
              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {fileSizeWarning}
        </div>
      )}

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
              disabled={isFileTooLarge}
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
