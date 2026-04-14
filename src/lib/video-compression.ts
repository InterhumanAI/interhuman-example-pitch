"use client";

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: number;
  audioBitrate: number;
  frameRate: number;
}

export const COMPRESSION_PRESETS: Record<string, CompressionOptions> = {
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
