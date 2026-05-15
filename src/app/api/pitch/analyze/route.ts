import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo, InterhumanAPIError } from "@/lib/interhuman";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  VERCEL_UPLOAD_MAX_BYTES,
  VERCEL_UPLOAD_MAX_MB,
} from "@/lib/upload-limits";

function jsonError(
  error: string,
  status: number,
  errorCode?: string
): NextResponse {
  return NextResponse.json(
    { error, ...(errorCode ? { errorCode } : {}) },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const durationStr = formData.get("duration") as string | null;
    const mode = (formData.get("mode") as string) || "free_pitch";
    const questionId = formData.get("questionId") as string | null;
    const userName = formData.get("userName") as string | null;

    if (!video) {
      return jsonError("No video file provided", 400, "MISSING_VIDEO");
    }

    if (video.size > VERCEL_UPLOAD_MAX_BYTES) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return jsonError(
        `Compressed video is still too large (${sizeMB}MB). Maximum upload size is ${VERCEL_UPLOAD_MAX_MB}MB. Please record a shorter video.`,
        413,
        "UPLOAD_TOO_LARGE"
      );
    }

    if (video.size > MAX_UPLOAD_SIZE_BYTES) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return jsonError(
        `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`,
        413,
        "FILE_TOO_LARGE"
      );
    }

    const duration = durationStr ? parseFloat(durationStr) : 60;
    const analysis = await analyzeVideo(video);

    const result = await completePitchAnalysis({
      analysis,
      duration,
      mode,
      userName,
      questionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Pitch analysis error:", error);

    if (error instanceof InterhumanAPIError) {
      if (error.errorCode === "MISSING_API_KEY") {
        return jsonError(
          "Pitch analysis is not configured on the server (missing INTERHUMAN_API_KEY).",
          500,
          "MISSING_API_KEY"
        );
      }

      return jsonError(
        error.message || "Interhuman analysis failed. Please try again.",
        error.statusCode || 500,
        error.errorCode
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    if (message.includes("INTERHUMAN_API_KEY")) {
      return jsonError(
        "Pitch analysis is not configured on the server (missing INTERHUMAN_API_KEY).",
        500,
        "MISSING_API_KEY"
      );
    }

    return jsonError(
      message || "Failed to analyze pitch. Please try again.",
      500,
      "ANALYSIS_FAILED"
    );
  }
}
