"use client";

import {
  VERCEL_UPLOAD_MAX_BYTES,
  VERCEL_UPLOAD_MAX_MB,
} from "@/lib/upload-limits";
import { pitchAnalyzeLog } from "@/lib/pitch-analyze-log";

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: number;
  audioBitrate: number;
  frameRate: number;
}

export const COMPRESSION_PRESETS: Record<string, CompressionOptions> = {
  aggressive: {
    maxWidth: 426,
    maxHeight: 240,
    videoBitrate: 280000,
    audioBitrate: 48000,
    frameRate: 20,
  },
  ultra: {
    maxWidth: 320,
    maxHeight: 180,
    videoBitrate: 180000,
    audioBitrate: 32000,
    frameRate: 15,
  },
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

export type CompressionProgressUpdate = {
  progress: number;
  pass: number;
  totalPasses: number;
  currentSizeBytes: number;
  originalSizeBytes: number;
};

export type CompressVideoForUploadResult = {
  blob: Blob;
  originalSize: number;
  finalSize: number;
  passes: number;
  skippedCompression: boolean;
};

export function formatCompressionStatus(
  update: CompressionProgressUpdate
): string {
  const originalMb = (update.originalSizeBytes / (1024 * 1024)).toFixed(1);
  const currentMb = (update.currentSizeBytes / (1024 * 1024)).toFixed(1);

  if (update.progress >= 1) {
    return `Ready — ${currentMb} MB`;
  }

  const passNum = Math.max(1, update.pass + 1);
  if (update.pass === 0 && update.progress < 0.05) {
    return `Compressing ${originalMb} MB…`;
  }

  return `Pass ${passNum}/${update.totalPasses} — ${currentMb} MB`;
}

const UPLOAD_COMPRESSION_CHAIN: CompressionOptions[] = [
  COMPRESSION_PRESETS.aggressive,
  COMPRESSION_PRESETS.ultra,
  COMPRESSION_PRESETS.minimal,
];

const MAX_EXTRA_REDUCTION_PASSES = 4;

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

  width = Math.floor(width / 2) * 2;
  height = Math.floor(height / 2) * 2;

  return { width, height };
}

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

    const canvasStream = this.canvas.captureStream(this.options.frameRate);

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
    video.preload = "auto";

    const objectUrl = URL.createObjectURL(blob);
    let audioCtx: AudioContext | null = null;
    let finished = false;
    let encodingStarted = false;
    let animationFrameId: number | null = null;
    let recorder: MediaRecorder | null = null;

    const cleanup = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
      if (audioCtx) {
        void audioCtx.close();
        audioCtx = null;
      }
    };

    const finish = (result: Blob) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      try {
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // ignore
      }
      cleanup();
      reject(error);
    };

    const startEncoding = () => {
      if (encodingStarted || finished) return;
      encodingStarted = true;

      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        fail(new Error("Invalid video duration for compression"));
        return;
      }

      const { width, height } = calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        options.maxWidth,
        options.maxHeight
      );

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail(new Error("Compression failed"));
        return;
      }

      const canvasStream = canvas.captureStream(options.frameRate);

      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        const audioTrack = destination.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      } catch {
        // Continue without re-encoded audio
      }

      const mimeType = getSupportedMimeType();
      recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: options.videoBitrate,
        audioBitsPerSecond: options.audioBitrate,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        finish(new Blob(chunks, { type: mimeType.split(";")[0] }));
      };

      recorder.onerror = () => {
        fail(new Error("Compression failed"));
      };

      video.ontimeupdate = () => {
        if (video.duration > 0) {
          onProgress?.(Math.min(video.currentTime / video.duration, 0.99));
        }
      };

      video.onended = () => {
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        }
      };

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      recorder.start();

      video
        .play()
        .then(() => {
          drawFrame();
        })
        .catch(() => fail(new Error("Failed to play video for compression")));

      // Fallback if onended does not fire
      const timeoutMs = Math.ceil(duration * 1000) + 5000;
      window.setTimeout(() => {
        if (!finished && recorder && recorder.state === "recording") {
          recorder.stop();
        }
      }, timeoutMs);
    };

    video.onloadedmetadata = () => {
      if (video.readyState >= 2) {
        startEncoding();
      }
    };

    video.onloadeddata = () => {
      if (!finished && (!recorder || recorder.state === "inactive")) {
        startEncoding();
      }
    };

    video.onerror = () => {
      fail(new Error("Failed to load video for compression"));
    };

    video.src = objectUrl;
  });
}

/**
 * Re-encode until the file fits the safe Vercel upload budget.
 */
export async function compressVideoForUpload(
  blob: Blob,
  onProgress?: (update: CompressionProgressUpdate) => void
): Promise<CompressVideoForUploadResult> {
  const originalSize = blob.size;
  const totalPasses =
    UPLOAD_COMPRESSION_CHAIN.length + MAX_EXTRA_REDUCTION_PASSES;

  pitchAnalyzeLog.info("Starting upload compression", {
    original: pitchAnalyzeLog.formatMb(originalSize),
    limit: pitchAnalyzeLog.formatMb(VERCEL_UPLOAD_MAX_BYTES),
    maxPasses: totalPasses,
  });

  if (blob.size <= VERCEL_UPLOAD_MAX_BYTES) {
    pitchAnalyzeLog.info("Already under upload limit — skipping compression", {
      size: pitchAnalyzeLog.formatMb(blob.size),
    });
    onProgress?.({
      progress: 1,
      pass: 0,
      totalPasses,
      currentSizeBytes: blob.size,
      originalSizeBytes: originalSize,
    });
    return {
      blob,
      originalSize,
      finalSize: blob.size,
      passes: 0,
      skippedCompression: true,
    };
  }

  let current = blob;
  let passIndex = 0;
  const sizeBeforePass = () => current.size;

  const emit = (passProgress: number) => {
    onProgress?.({
      progress: Math.min((passIndex + passProgress) / totalPasses, 0.99),
      pass: passIndex,
      totalPasses,
      currentSizeBytes: current.size,
      originalSizeBytes: originalSize,
    });
  };

  for (const preset of UPLOAD_COMPRESSION_CHAIN) {
    const before = sizeBeforePass();
    current = await compressVideoBlob(current, preset, emit);
    passIndex += 1;
    pitchAnalyzeLog.info(`Compression pass ${passIndex}/${totalPasses}`, {
      preset: `${preset.maxWidth}x${preset.maxHeight}`,
      before: pitchAnalyzeLog.formatMb(before),
      after: pitchAnalyzeLog.formatMb(current.size),
    });
    onProgress?.({
      progress: Math.min(passIndex / totalPasses, 0.99),
      pass: passIndex,
      totalPasses,
      currentSizeBytes: current.size,
      originalSizeBytes: originalSize,
    });

    if (current.size <= VERCEL_UPLOAD_MAX_BYTES) {
      pitchAnalyzeLog.info("Compression complete — ready to upload", {
        original: pitchAnalyzeLog.formatMb(originalSize),
        final: pitchAnalyzeLog.formatMb(current.size),
        passes: passIndex,
      });
      onProgress?.({
        progress: 1,
        pass: passIndex,
        totalPasses,
        currentSizeBytes: current.size,
        originalSizeBytes: originalSize,
      });
      return {
        blob: current,
        originalSize,
        finalSize: current.size,
        passes: passIndex,
        skippedCompression: false,
      };
    }
  }

  let reductionFactor = 0.9;
  for (let i = 0; i < MAX_EXTRA_REDUCTION_PASSES; i++) {
    const preset = scaleCompressionOptions(
      COMPRESSION_PRESETS.minimal,
      reductionFactor
    );
    const before = sizeBeforePass();
    current = await compressVideoBlob(current, preset, emit);
    passIndex += 1;
    pitchAnalyzeLog.info(`Extra reduction pass ${passIndex}/${totalPasses}`, {
      before: pitchAnalyzeLog.formatMb(before),
      after: pitchAnalyzeLog.formatMb(current.size),
    });
    onProgress?.({
      progress: Math.min(passIndex / totalPasses, 0.99),
      pass: passIndex,
      totalPasses,
      currentSizeBytes: current.size,
      originalSizeBytes: originalSize,
    });

    if (current.size <= VERCEL_UPLOAD_MAX_BYTES) {
      pitchAnalyzeLog.info("Compression complete — ready to upload", {
        original: pitchAnalyzeLog.formatMb(originalSize),
        final: pitchAnalyzeLog.formatMb(current.size),
        passes: passIndex,
      });
      onProgress?.({
        progress: 1,
        pass: passIndex,
        totalPasses,
        currentSizeBytes: current.size,
        originalSizeBytes: originalSize,
      });
      return {
        blob: current,
        originalSize,
        finalSize: current.size,
        passes: passIndex,
        skippedCompression: false,
      };
    }

    reductionFactor *= 0.85;
  }

  const sizeMB = (current.size / (1024 * 1024)).toFixed(1);
  pitchAnalyzeLog.error("Could not compress below upload limit", {
    final: `${sizeMB} MB`,
    passes: passIndex,
    limit: pitchAnalyzeLog.formatMb(VERCEL_UPLOAD_MAX_BYTES),
  });
  throw new Error(
    `Could not compress below ${VERCEL_UPLOAD_MAX_MB}MB (still ${sizeMB}MB after ${passIndex} passes). Please record a shorter video.`
  );
}
