"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trophy, Medal, Award, Loader2 } from "lucide-react";
import { Badge } from "@/types";

interface LeaderboardEntry {
  rank: number;
  visitorId: string;
  userName: string;
  userAvatar: string | null;
  score: number;
  badges: Badge[];
  createdAt: string;
}

interface LeaderboardData {
  period: string;
  mode: string;
  entries: LeaderboardEntry[];
  totalEntries: number;
  message?: string;
  error?: string;
}

interface UserStats {
  bestScore: number;
  rank: number | null;
  totalAttempts: number;
  recentScores: number[];
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 text-center font-mono">{rank}</span>;
}

function LeaderboardTable({ data, isLoading }: { data: LeaderboardEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No entries yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((entry) => (
        <Card
          key={`${entry.rank}-${entry.visitorId}`}
          className={
            entry.rank <= 3
              ? "border-primary/30 bg-primary/5"
              : ""
          }
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-8 flex justify-center">
              {getRankIcon(entry.rank)}
            </div>
            <Avatar>
              <AvatarImage src={entry.userAvatar || undefined} />
              <AvatarFallback>
                {entry.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{entry.userName}</p>
              <div className="flex gap-1">
                {entry.badges.slice(0, 3).map((badge, i) => (
                  <span key={i} className="text-sm" title={badge.name}>
                    {badge.icon}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{entry.score}</p>
              <p className="text-xs text-muted-foreground">points</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "alltime">("weekly");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period]);

  useEffect(() => {
    // Load user stats from localStorage (their challenge history)
    loadUserStats();
  }, []);

  const fetchLeaderboard = async (selectedPeriod: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?period=${selectedPeriod}&limit=20`);
      const data = await response.json();
      setLeaderboardData(data);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserStats = () => {
    // Get stats from localStorage (saved after each challenge)
    const statsJson = localStorage.getItem("pitchperfect_challenge_stats");
    if (statsJson) {
      try {
        const stats = JSON.parse(statsJson);
        setUserStats(stats);
      } catch {
        // Invalid data, ignore
      }
    }
  };

  const entries = leaderboardData?.entries || [];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <h1 className="ml-4 font-semibold">Leaderboard</h1>
          </div>
          <Button asChild>
            <Link href="/challenge">Take the Challenge</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Top Pitchers</h2>
            <p className="text-muted-foreground">
              See how you stack up against other founders
            </p>
            {leaderboardData?.totalEntries ? (
              <p className="text-sm text-muted-foreground mt-1">
                {leaderboardData.totalEntries} total entries
              </p>
            ) : null}
          </div>

          <Tabs 
            defaultValue="weekly" 
            value={period}
            onValueChange={(v) => setPeriod(v as typeof period)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="weekly">This Week</TabsTrigger>
              <TabsTrigger value="monthly">This Month</TabsTrigger>
              <TabsTrigger value="alltime">All Time</TabsTrigger>
            </TabsList>

            <TabsContent value="weekly">
              <LeaderboardTable data={entries} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="monthly">
              <LeaderboardTable data={entries} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="alltime">
              <LeaderboardTable data={entries} isLoading={isLoading} />
            </TabsContent>
          </Tabs>

          {leaderboardData?.message && (
            <p className="text-center text-sm text-muted-foreground mt-4 p-4 bg-secondary/50 rounded-lg">
              {leaderboardData.message}
            </p>
          )}

          {/* Your Stats Card - Below Leaderboard */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Your Stats</CardTitle>
            </CardHeader>
            <CardContent>
              {userStats && userStats.totalAttempts > 0 ? (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-primary">{userStats.bestScore}</p>
                    <p className="text-xs text-muted-foreground">Best Score</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {userStats.rank ? `#${userStats.rank}` : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">Your Rank</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{userStats.totalAttempts}</p>
                    <p className="text-xs text-muted-foreground">Attempts</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>Take the 1-Minute Challenge to see your stats!</p>
                  <Button className="mt-4" asChild>
                    <Link href="/challenge">Start Challenge</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
