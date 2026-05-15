import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo, InterhumanAPIError } from "@/lib/interhuman";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  VERCEL_UPLOAD_MAX_BYTES,
  VERCEL_UPLOAD_MAX_MB,
} from "@/lib/upload-limits";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const durationStr = formData.get("duration") as string | null;
    const mode = (formData.get("mode") as string) || "free_pitch";
    const questionId = formData.get("questionId") as string | null;
    const userName = formData.get("userName") as string | null;

    if (!video) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    if (video.size > VERCEL_UPLOAD_MAX_BYTES) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `Compressed video is still too large (${sizeMB}MB). Maximum upload size is ${VERCEL_UPLOAD_MAX_MB}MB. Please record a shorter video.`,
          errorCode: "UPLOAD_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    if (video.size > MAX_UPLOAD_SIZE_BYTES) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`,
          errorCode: "FILE_TOO_LARGE",
        },
        { status: 413 }
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
      return NextResponse.json(
        {
          error: error.message,
          errorCode: error.errorCode,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze pitch. Please try again." },
      { status: 500 }
    );
  }
}
