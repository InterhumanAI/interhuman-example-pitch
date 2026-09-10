"use client";

import { VIDEO_STORAGE_DB_NAME } from "@/lib/brand";

const DB_NAME = VIDEO_STORAGE_DB_NAME;
const DB_VERSION = 1;
const STORE_NAME = "videos";

export interface StoredVideo {
  id: string;
  blob: Blob;
  duration: number;
  mode: "free_pitch" | "one_minute_challenge" | "qa_practice";
  questionId?: string;
  questionText?: string;
  createdAt: Date;
  analyzed: boolean;
  score?: number;
  thumbnailUrl?: string;
  // Store full results for viewing later
  analysisResult?: {
    pitchScore: {
      composite: number;
      percentile: number;
      breakdown: {
        authority: number;
        clarity: number;
        energy: number;
        confidence: number;
        lowHesitation: number;
      };
      badges: Array<{ id: string; name: string; description: string; icon: string }>;
    };
    signals: Array<{
      type: string;
      start: number;
      end: number;
      probability: string;
      rationale: string;
    }>;
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("mode", "mode", { unique: false });
      }
    };
  });
}

export async function saveVideo(video: StoredVideo): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(video);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getVideo(id: string): Promise<StoredVideo | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getAllVideos(): Promise<StoredVideo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("createdAt");
    const request = index.openCursor(null, "prev");

    const videos: StoredVideo[] = [];
    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        videos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(videos);
      }
    };
  });
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updateVideoAnalyzed(
  id: string,
  score: number,
  analysisResult?: StoredVideo["analysisResult"]
): Promise<void> {
  const video = await getVideo(id);
  if (video) {
    video.analyzed = true;
    video.score = score;
    if (analysisResult) {
      video.analysisResult = analysisResult;
    }
    await saveVideo(video);
  }
}

export async function getStorageUsage(): Promise<{
  used: number;
  count: number;
}> {
  const videos = await getAllVideos();
  const used = videos.reduce((total, v) => total + v.blob.size, 0);
  return { used, count: videos.length };
}

export function generateVideoId(): string {
  return `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// A thumbnail is a nice-to-have, but it is generated on the critical path before
// a pitch is submitted — so it must never be able to block forever. MediaRecorder
// blobs frequently report `duration: Infinity` (or NaN before metadata lands), and
// a seek on such a blob can silently never fire `seeked`, leaving the promise
// pending for the rest of the session.
const THUMBNAIL_TIMEOUT_MS = 5000;

export async function generateThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(blob);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error("Timed out generating thumbnail"))),
      THUMBNAIL_TIMEOUT_MS,
    );

    video.onloadeddata = () => {
      // MediaRecorder blobs commonly report `duration: Infinity` (and NaN before
      // metadata lands). `Math.min(1, Infinity)` is 1, which seeks fine — but a
      // NaN target throws inside this handler, so `seeked` would never fire and
      // the promise would hang. Fall back to 1s for any non-finite duration.
      const midpoint = video.duration / 2;
      video.currentTime = Number.isFinite(midpoint) ? Math.min(1, midpoint) : 1;
    };

    video.onseeked = () => {
      finish(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      });
    };

    video.onerror = () => {
      finish(() => reject(new Error("Failed to load video for thumbnail")));
    };

    video.src = objectUrl;
  });
}

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
