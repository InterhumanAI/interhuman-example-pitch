import { NextRequest, NextResponse } from "next/server";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import type { InterhumanAnalysisResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysis, duration, mode, userName, questionId } = body as {
      analysis: InterhumanAnalysisResponse;
      score: unknown;
      duration: number;
      mode: string;
      userName: string | null;
      questionId: string | null;
    };

    if (!analysis || !analysis.signals) {
      return NextResponse.json(
        { error: "Invalid analysis payload" },
        { status: 400 }
      );
    }

    const result = await completePitchAnalysis({
      analysis,
      duration: duration || 60,
      mode: mode || "free_pitch",
      userName,
      questionId,
    });

    return NextResponse.json({
      pitchId: result.pitchId,
      scoreId: result.scoreId,
      savedToLeaderboard: result.savedToLeaderboard,
      percentile: result.score.percentile,
    });
  } catch (error) {
    console.error("Save results error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
