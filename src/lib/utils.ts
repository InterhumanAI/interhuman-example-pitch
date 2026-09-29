import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Below Average";
  return "Needs Work";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 65) return "text-emerald-500";
  if (score >= 50) return "text-yellow-500";
  if (score >= 30) return "text-orange-500";
  return "text-red-500";
}

/**
 * File extension matching a recorded video Blob's actual MIME type. Safari
 * records video/mp4 (it doesn't support WebM), so downloads must not hardcode
 * ".webm" or the resulting file plays incorrectly in some players.
 */
export function getVideoFileExtension(blob: Blob): string {
  return blob.type.includes("mp4") ? "mp4" : "webm";
}
