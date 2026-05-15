import { NextRequest, NextResponse } from "next/server";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import { InterhumanAnalysisResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const analysis = body.analysis as InterhumanAnalysisResponse | undefined;
    const duration = typeof body.duration === "number" ? body.duration : parseFloat(body.duration);
    const mode = (body.mode as string) || "free_pitch";
    const userName = (body.userName as string) || null;
    const questionId = (body.questionId as string) || null;

    if (!analysis?.signals) {
      return NextResponse.json(
        { error: "Invalid analysis payload" },
        { status: 400 }
      );
    }

    if (!duration || Number.isNaN(duration)) {
      return NextResponse.json(
        { error: "Invalid duration" },
        { status: 400 }
      );
    }

    const result = await completePitchAnalysis({
      analysis,
      duration,
      mode,
      userName,
      questionId,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to complete pitch analysis" },
      { status: 500 }
    );
  }
}
