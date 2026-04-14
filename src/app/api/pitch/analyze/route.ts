import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo, InterhumanAPIError } from "@/lib/interhuman";
import { calculatePitchScore } from "@/lib/scoring";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/db";

const MAX_FILE_SIZE_MB = 32;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Check file size before processing
    if (video.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { 
          error: `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please record a shorter video.`,
          errorCode: "FILE_TOO_LARGE"
        },
        { status: 413 }
      );
    }

    const duration = durationStr ? parseFloat(durationStr) : 60;

    // Analyze video with Interhuman API
    const analysis = await analyzeVideo(video);

    // Calculate pitch score (handles missing data gracefully)
    const scoreWithoutPercentile = calculatePitchScore(analysis, duration);

    // Calculate real percentile from database (or estimate if DB not configured)
    const percentile = await calculatePercentile(scoreWithoutPercentile.composite, mode);

    const score = {
      ...scoreWithoutPercentile,
      percentile,
    };

    // Use the display name the user entered
    const userDisplayName: string | null = userName;

    // Save to database if Supabase is configured
    // For challenge mode, save even without login (anonymous entry)
    let pitchId: string | null = null;
    let scoreId: string | null = null;
    if (isSupabaseConfigured()) {
      const result = await savePitchToDatabase({
        userName: userDisplayName,
        duration,
        mode: mode as "free_pitch" | "one_minute_challenge" | "qa_practice",
        questionId,
        analysis,
        score,
      });
      pitchId = result?.pitchId || null;
      scoreId = result?.scoreId || null;
    }

    return NextResponse.json({
      analysis,
      score,
      mode,
      duration,
      pitchId,
      scoreId,
      savedToLeaderboard: !!scoreId && mode === "one_minute_challenge",
    });
  } catch (error) {
    console.error("Pitch analysis error:", error);
    
    // Handle specific error types
    if (error instanceof InterhumanAPIError) {
      return NextResponse.json(
        { 
          error: error.message,
          errorCode: error.errorCode 
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

async function savePitchToDatabase({
  userName,
  duration,
  mode,
  questionId,
  analysis,
  score,
}: {
  userName: string | null;
  duration: number;
  mode: "free_pitch" | "one_minute_challenge" | "qa_practice";
  questionId: string | null;
  analysis: Awaited<ReturnType<typeof analyzeVideo>>;
  score: ReturnType<typeof calculatePitchScore> & { percentile: number };
}): Promise<{ pitchId: string; scoreId: string } | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const pitchId = generateId();
    const analysisId = generateId();
    const scoreId = generateId();

    // Create an anonymous user ID for each submission
    const visitorId = `anon_${generateId()}`;
    const effectiveUserName = userName || "Anonymous Founder";

    // Insert Pitch
    const { error: pitchError } = await supabaseAdmin.from("Pitch").insert({
      id: pitchId,
      visitorId,
      durationSeconds: duration,
      mode,
      createdAt: new Date().toISOString(),
    });

    if (pitchError) {
      console.error("Error saving pitch:", pitchError);
      return null;
    }

    // Insert PitchAnalysis (handle missing conversation_quality)
    const conversationQuality = analysis.conversation_quality?.overall;
    const engagementStates = analysis.engagement_states || (analysis as any).engagement_state || [];
    
    const { error: analysisError } = await supabaseAdmin
      .from("PitchAnalysis")
      .insert({
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

    // Insert PitchScore (for leaderboard)
    const { error: scoreError } = await supabaseAdmin
      .from("PitchScore")
      .insert({
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
    
    // Build query - filter by mode if it's a challenge
    let lowerQuery = supabaseAdmin
      .from("PitchScore")
      .select("*", { count: "exact", head: true })
      .lt("compositeScore", compositeScore);
    
    let totalQuery = supabaseAdmin
      .from("PitchScore")
      .select("*", { count: "exact", head: true });

    // For challenge mode, only compare against other challenge scores
    if (mode === "one_minute_challenge") {
      lowerQuery = lowerQuery.eq("mode", "one_minute_challenge");
      totalQuery = totalQuery.eq("mode", "one_minute_challenge");
    }

    const { count: lowerCount } = await lowerQuery;
    const { count: totalCount } = await totalQuery;

    if (!totalCount || totalCount === 0) {
      return estimatePercentile(compositeScore);
    }

    const percentile = ((lowerCount || 0) / totalCount) * 100;
    return Math.round(percentile);
  } catch (error) {
    console.error("Error calculating percentile:", error);
    return estimatePercentile(compositeScore);
  }
}

function estimatePercentile(score: number): number {
  // Fallback estimation when no data exists
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
