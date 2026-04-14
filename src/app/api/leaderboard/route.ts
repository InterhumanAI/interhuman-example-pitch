import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/db";
import { BADGES } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "weekly";
  const limit = parseInt(searchParams.get("limit") || "10");
  const mode = searchParams.get("mode") || "one_minute_challenge";

  // Return empty state if Supabase isn't configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      period,
      mode,
      entries: [],
      totalEntries: 0,
      message: "Database not configured. Connect Supabase to enable the leaderboard.",
    });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    // Calculate date filter based on period
    let dateFilter: string | null = null;
    const now = new Date();
    
    if (period === "weekly") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = weekAgo.toISOString();
    } else if (period === "monthly") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = monthAgo.toISOString();
    }
    // "alltime" has no date filter

    // Query for top scores - filter by mode (challenge only by default)
    let query = supabaseAdmin
      .from("PitchScore")
      .select(`
        id,
        compositeScore,
        badgesEarned,
        createdAt,
        visitorId,
        userName,
        mode
      `)
      .eq("mode", mode)
      .order("compositeScore", { ascending: false })
      .limit(limit);

    if (dateFilter) {
      query = query.gte("createdAt", dateFilter);
    }

    const { data: scores, error } = await query;

    if (error) {
      console.error("Error fetching leaderboard:", error);
      return NextResponse.json({
        period,
        mode,
        entries: [],
        totalEntries: 0,
        error: "Failed to load leaderboard data",
      });
    }

    if (!scores || scores.length === 0) {
      return NextResponse.json({
        period,
        mode,
        entries: [],
        totalEntries: 0,
      });
    }

    // Transform to leaderboard entries
    const entries = scores.map((score, index) => {
      const badges = (score.badgesEarned || [])
        .map((badgeId: string) => BADGES.find((b) => b.id === badgeId))
        .filter(Boolean);

      return {
        rank: index + 1,
        visitorId: score.visitorId,
        userName: score.userName || "Anonymous Founder",
        userAvatar: null,
        score: score.compositeScore,
        badges,
        createdAt: score.createdAt,
      };
    });

    // Get total count for this mode
    let countQuery = supabaseAdmin
      .from("PitchScore")
      .select("*", { count: "exact", head: true })
      .eq("mode", mode);
    
    if (dateFilter) {
      countQuery = countQuery.gte("createdAt", dateFilter);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      period,
      mode,
      entries,
      totalEntries: count || entries.length,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({
      period,
      mode,
      entries: [],
      totalEntries: 0,
      error: "Failed to load leaderboard",
    });
  }
}
