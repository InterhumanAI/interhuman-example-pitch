"use client";

import {
  VERCEL_UPLOAD_MAX_BYTES,
  VERCEL_UPLOAD_MAX_MB,
} from "@/lib/upload-limits";

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: number;
  audioBitrate: number;
  frameRate: number;
}

export const COMPRESSION_PRESETS: Record<string, CompressionOptions> = {
  /** Default for recording + upload — small enough for Vercel, OK for analysis */
  aggressive: {
    maxWidth: 426,
    maxHeight: 240,
    videoBitrate: 280000,
    audioBitrate: 48000,
    frameRate: 20,
  },
  /** Second pass if aggressive is still over the upload cap */
  ultra: {
    maxWidth: 320,
    maxHeight: 180,
    videoBitrate: 180000,
    audioBitrate: 32000,
    frameRate: 15,
  },
  /** Third pass — smallest preset before dynamic reduction */
  minimal: {
    maxWidth: 256,
    maxHeight: 144,
    videoBitrate: 120000,
    audioBitrate: 24000,
    frameRate: 12,
  },
  low: {
    maxWidth: 480,
    maxHeight: 360,
    videoBitrate: 500000,
    audioBitrate: 64000,
    frameRate: 24,
  },
  medium: {
    maxWidth: 640,
    maxHeight: 480,
    videoBitrate: 1000000,
    audioBitrate: 128000,
    frameRate: 24,
  },
  high: {
    maxWidth: 1280,
    maxHeight: 720,
    videoBitrate: 2500000,
    audioBitrate: 128000,
    frameRate: 30,
  },
};

export function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "video/webm";
}

export function calculateDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = sourceWidth / sourceHeight;

  let width = sourceWidth;
  let height = sourceHeight;

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  // Ensure dimensions are even (required for some codecs)
  width = Math.floor(width / 2) * 2;
  height = Math.floor(height / 2) * 2;

  return { width, height };
}

export class ResizingMediaRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElement: HTMLVideoElement;
  private animationFrameId: number | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private options: CompressionOptions;
  private isRecording = false;

  public ondataavailable: ((blob: Blob) => void) | null = null;
  public onstop: ((blob: Blob) => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;

  constructor(options: CompressionOptions = COMPRESSION_PRESETS.medium) {
    this.options = options;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this.videoElement = document.createElement("video");
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
  }

  async start(sourceStream: MediaStream): Promise<void> {
    const videoTrack = sourceStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const sourceWidth = settings.width || 640;
    const sourceHeight = settings.height || 480;

    const { width, height } = calculateDimensions(
      sourceWidth,
      sourceHeight,
      this.options.maxWidth,
      this.options.maxHeight
    );

    this.canvas.width = width;
    this.canvas.height = height;

    this.videoElement.srcObject = sourceStream;
    await this.videoElement.play();

    // Create a stream from the canvas
    const canvasStream = this.canvas.captureStream(this.options.frameRate);

    // Add audio track from original stream
    const audioTracks = sourceStream.getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }

    this.stream = canvasStream;
    this.chunks = [];

    const mimeType = getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: this.options.videoBitrate,
      audioBitsPerSecond: this.options.audioBitrate,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
        this.ondataavailable?.(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const mimeTypeBase = mimeType.split(";")[0];
      const blob = new Blob(this.chunks, { type: mimeTypeBase });
      this.onstop?.(blob);
      this.cleanup();
    };

    this.mediaRecorder.onerror = (e) => {
      this.onerror?.(new Error(`MediaRecorder error: ${e}`));
    };

    // Start drawing frames to canvas
    this.isRecording = true;
    this.drawFrame();

    this.mediaRecorder.start(1000);
  }

  private drawFrame = (): void => {
    if (!this.isRecording) return;

    this.ctx.drawImage(
      this.videoElement,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.animationFrameId = requestAnimationFrame(this.drawFrame);
  };

  stop(): void {
    this.isRecording = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.isRecording = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.isRecording = true;
      this.drawFrame();
    }
  }

  private cleanup(): void {
    this.isRecording = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.videoElement.srcObject = null;
  }

  get state(): RecordingState {
    return this.mediaRecorder?.state || "inactive";
  }
}

export async function compressVideoBlob(
  blob: Blob,
  options: CompressionOptions = COMPRESSION_PRESETS.medium,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      const { width, height } = calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        options.maxWidth,
        options.maxHeight
      );

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      const canvasStream = canvas.captureStream(options.frameRate);

      // Try to get audio from the original video
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioCtx.destination);
        const audioTrack = destination.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      } catch {
        // Audio extraction failed, continue without audio
      }

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: options.videoBitrate,
        audioBitsPerSecond: options.audioBitrate,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: mimeType.split(";")[0] });
        URL.revokeObjectURL(video.src);
        resolve(compressedBlob);
      };

      recorder.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Compression failed"));
      };

      video.ontimeupdate = () => {
        onProgress?.(video.currentTime / video.duration);
      };

      video.onended = () => {
        recorder.stop();
      };

      recorder.start();

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(drawFrame);
      };

      video.play();
      drawFrame();
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video for compression"));
    };

    video.src = URL.createObjectURL(blob);
  });
}

const UPLOAD_COMPRESSION_CHAIN: CompressionOptions[] = [
  COMPRESSION_PRESETS.aggressive,
  COMPRESSION_PRESETS.ultra,
  COMPRESSION_PRESETS.minimal,
];

const MAX_EXTRA_REDUCTION_PASSES = 4;

function scaleCompressionOptions(
  base: CompressionOptions,
  factor: number
): CompressionOptions {
  return {
    maxWidth: Math.max(160, Math.floor((base.maxWidth * factor) / 2) * 2),
    maxHeight: Math.max(90, Math.floor((base.maxHeight * factor) / 2) * 2),
    videoBitrate: Math.max(80000, Math.round(base.videoBitrate * factor)),
    audioBitrate: Math.max(16000, Math.round(base.audioBitrate * factor)),
    frameRate: Math.max(10, Math.round(base.frameRate * factor)),
  };
}

/**
 * Re-encode until the file fits Vercel's ~4.5MB body limit.
 * Runs the first pass, checks size, then compresses again until under the cap.
 */
export async function compressVideoForUpload(
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  let current = blob;
  const totalPlannedPasses =
    UPLOAD_COMPRESSION_CHAIN.length + MAX_EXTRA_REDUCTION_PASSES;
  let passIndex = 0;

  const reportPassProgress = (passProgress: number) => {
    if (!onProgress) return;
    const overall = (passIndex + passProgress) / totalPlannedPasses;
    onProgress(Math.min(overall, 0.99));
  };

  for (const preset of UPLOAD_COMPRESSION_CHAIN) {
    current = await compressVideoBlob(current, preset, reportPassProgress);
    passIndex += 1;

    if (current.size <= VERCEL_UPLOAD_MAX_BYTES) {
      onProgress?.(1);
      return current;
    }
  }

  let reductionFactor = 0.9;
  for (let i = 0; i < MAX_EXTRA_REDUCTION_PASSES; i++) {
    const preset = scaleCompressionOptions(
      COMPRESSION_PRESETS.minimal,
      reductionFactor
    );
    current = await compressVideoBlob(current, preset, reportPassProgress);
    passIndex += 1;

    if (current.size <= VERCEL_UPLOAD_MAX_BYTES) {
      onProgress?.(1);
      return current;
    }

    reductionFactor *= 0.85;
  }

  const sizeMB = (current.size / (1024 * 1024)).toFixed(1);
  throw new Error(
    `Video is still too large after compression (${sizeMB}MB). Maximum upload size is ${VERCEL_UPLOAD_MAX_MB}MB. Please record a shorter video.`
  );
}
