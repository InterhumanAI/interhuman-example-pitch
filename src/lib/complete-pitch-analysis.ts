import { InterhumanAnalysisResponse, PitchScore } from "@/types";
import { calculatePitchScore } from "@/lib/scoring";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/db";
import type { PitchAnalyzeApiResponse } from "@/types/pitch-api";

export type PitchMode = "free_pitch" | "one_minute_challenge" | "qa_practice";

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function completePitchAnalysis({
  analysis,
  duration,
  mode,
  userName = null,
  questionId = null,
  videoUrl = null,
  videoPathname = null,
}: {
  analysis: InterhumanAnalysisResponse;
  duration: number;
  mode: string;
  userName?: string | null;
  questionId?: string | null;
  videoUrl?: string | null;
  videoPathname?: string | null;
}): Promise<PitchAnalyzeApiResponse> {
  const scoreWithoutPercentile = calculatePitchScore(analysis, duration);
  const percentile = await calculatePercentile(scoreWithoutPercentile.composite, mode);

  const score: PitchScore = {
    ...scoreWithoutPercentile,
    percentile,
  };

  let pitchId: string | null = null;
  let scoreId: string | null = null;

  if (isSupabaseConfigured()) {
    const result = await savePitchToDatabase({
      userName,
      duration,
      mode: mode as PitchMode,
      questionId,
      analysis,
      score,
      videoUrl,
      videoPathname,
    });
    pitchId = result?.pitchId || null;
    scoreId = result?.scoreId || null;
  }

  return {
    analysis,
    score,
    mode,
    duration,
    pitchId,
    scoreId,
    savedToLeaderboard: !!scoreId && mode === "one_minute_challenge",
  };
}

async function savePitchToDatabase({
  userName,
  duration,
  mode,
  questionId,
  analysis,
  score,
  videoUrl,
  videoPathname,
}: {
  userName: string | null;
  duration: number;
  mode: PitchMode;
  questionId: string | null;
  analysis: InterhumanAnalysisResponse;
  score: PitchScore;
  videoUrl?: string | null;
  videoPathname?: string | null;
}): Promise<{ pitchId: string; scoreId: string } | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const pitchId = generateId();
    const analysisId = generateId();
    const scoreId = generateId();

    const visitorId = `anon_${generateId()}`;
    const effectiveUserName = userName || "Anonymous Founder";

    const pitchRow: Record<string, unknown> = {
      id: pitchId,
      visitorId,
      durationSeconds: duration,
      mode,
      createdAt: new Date().toISOString(),
    };
    if (videoUrl) pitchRow.videoUrl = videoUrl;
    if (videoPathname) pitchRow.videoPathname = videoPathname;

    const { error: pitchError } = await supabaseAdmin.from("Pitch").insert(pitchRow);

    if (pitchError) {
      console.error("Error saving pitch:", pitchError);
      return null;
    }

    const conversationQuality = analysis.conversation_quality?.overall;
    const engagementStates =
      analysis.engagement_states || (analysis as { engagement_state?: unknown[] }).engagement_state || [];

    const { error: analysisError } = await supabaseAdmin.from("PitchAnalysis").insert({
      id: analysisId,
      pitchId,
      qualityIndex: Math.round(conversationQuality?.quality_index ?? score.composite),
      clarity: Math.round(conversationQuality?.clarity ?? score.breakdown.clarity),
      authority: Math.round(conversationQuality?.authority ?? score.breakdown.authority),
      energy: Math.round(conversationQuality?.energy ?? score.breakdown.energy),
      rapport: Math.round(conversationQuality?.rapport ?? 50),
      learning: Math.round(conversationQuality?.learning ?? 50),
      engagementStatesJson: engagementStates,
      signalsJson: analysis.signals,
      timelineJson: analysis.conversation_quality?.timeline || [],
      createdAt: new Date().toISOString(),
    });

    if (analysisError) {
      console.error("Error saving analysis:", analysisError);
    }

    const { error: scoreError } = await supabaseAdmin.from("PitchScore").insert({
      id: scoreId,
      pitchId,
      visitorId,
      userName: effectiveUserName,
      mode,
      compositeScore: Math.round(score.composite),
      percentileRank: score.percentile,
      authorityScore: Math.round(score.breakdown.authority),
      clarityScore: Math.round(score.breakdown.clarity),
      energyScore: Math.round(score.breakdown.energy),
      confidenceScore: Math.round(score.breakdown.confidence),
      hesitationScore: Math.round(score.breakdown.lowHesitation),
      badgesEarned: score.badges.map((b) => b.id),
      createdAt: new Date().toISOString(),
    });

    if (scoreError) {
      console.error("Error saving score:", scoreError);
      return { pitchId, scoreId: "" };
    }

    return { pitchId, scoreId };
  } catch (error) {
    console.error("Error saving to database:", error);
    return null;
  }
}

async function calculatePercentile(compositeScore: number, mode?: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return estimatePercentile(compositeScore);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    let lowerQuery = supabaseAdmin
      .from("PitchScore")
      .select("*", { count: "exact", head: true })
      .lt("compositeScore", compositeScore);

    let totalQuery = supabaseAdmin.from("PitchScore").select("*", { count: "exact", head: true });

    if (mode === "one_minute_challenge") {
      lowerQuery = lowerQuery.eq("mode", "one_minute_challenge");
      totalQuery = totalQuery.eq("mode", "one_minute_challenge");
    }

    const { count: lowerCount } = await lowerQuery;
    const { count: totalCount } = await totalQuery;

    if (!totalCount || totalCount === 0) {
      return estimatePercentile(compositeScore);
    }

    return Math.round(((lowerCount || 0) / totalCount) * 100);
  } catch (error) {
    console.error("Error calculating percentile:", error);
    return estimatePercentile(compositeScore);
  }
}

function estimatePercentile(score: number): number {
  if (score >= 85) return 95;
  if (score >= 80) return 90;
  if (score >= 75) return 85;
  if (score >= 70) return 75;
  if (score >= 65) return 65;
  if (score >= 60) return 55;
  if (score >= 55) return 45;
  if (score >= 50) return 35;
  return 25;
}
