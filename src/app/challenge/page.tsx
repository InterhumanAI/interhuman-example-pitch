"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { VideoRecorder } from "@/components/video-recorder";
import { ResultsDisplay } from "@/components/results-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InterhumanAnalysisResponse, PitchScore } from "@/types";
import { ArrowLeft, Loader2, Timer, Trophy, Zap, CheckCircle, FolderOpen, Play, X } from "lucide-react";
import { CHALLENGE_STATS_STORAGE_KEY } from "@/lib/brand";
import { getAllVideos, StoredVideo, formatStorageSize } from "@/lib/video-storage";
import { submitPitchAnalysis } from "@/lib/submit-pitch-analysis";

type PageState = "intro" | "record" | "analyzing" | "results" | "select-video";

export default function ChallengePage() {
  const [pageState, setPageState] = useState<PageState>("intro");
  const [analysis, setAnalysis] = useState<InterhumanAnalysisResponse | null>(null);
  const [pitchScore, setPitchScore] = useState<PitchScore | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [savedToLeaderboard, setSavedToLeaderboard] = useState(false);
  const [savedVideos, setSavedVideos] = useState<StoredVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StoredVideo | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const saveUserStats = (newScore: number) => {
    try {
      const statsJson = localStorage.getItem(CHALLENGE_STATS_STORAGE_KEY);
      let stats = statsJson ? JSON.parse(statsJson) : {
        bestScore: 0,
        rank: null,
        totalAttempts: 0,
        recentScores: [],
      };

      stats.totalAttempts += 1;
      stats.recentScores = [newScore, ...stats.recentScores.slice(0, 9)];
      if (newScore > stats.bestScore) {
        stats.bestScore = newScore;
      }

      localStorage.setItem(CHALLENGE_STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // localStorage not available
    }
  };

  const handleRecordingComplete = async (blob: Blob, recordedDuration: number) => {
    setPageState("analyzing");
    setDuration(recordedDuration);
    setError(null);

    try {
      const data = await submitPitchAnalysis({
        blob,
        duration: recordedDuration,
        mode: "one_minute_challenge",
        userName: userName.trim() || undefined,
      });
      setAnalysis(data.analysis);
      setPitchScore(data.score);
      setSavedToLeaderboard(data.savedToLeaderboard || false);
      setPageState("results");

      // Save stats to localStorage for the leaderboard page
      saveUserStats(data.score.composite);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze your pitch. Please try again.");
      setPageState("record");
    }
  };

  const handleRetry = () => {
    setPageState("intro");
    setAnalysis(null);
    setPitchScore(null);
    setSavedToLeaderboard(false);
    setSelectedVideo(null);
    setError(null);
  };

  const startChallenge = () => {
    setPageState("record");
  };

  const loadSavedVideos = async () => {
    setLoadingVideos(true);
    try {
      const allVideos = await getAllVideos();
      // Filter videos to only show those between 45-60 seconds for the challenge
      const eligibleVideos = allVideos.filter(
        (video) => video.duration >= 45 && video.duration <= 60
      );
      setSavedVideos(eligibleVideos);
      setPageState("select-video");
    } catch (err) {
      console.error("Failed to load saved videos:", err);
      setError("Failed to load saved videos.");
    } finally {
      setLoadingVideos(false);
    }
  };

  const selectVideo = (video: StoredVideo) => {
    setSelectedVideo(video);
  };

  const submitSelectedVideo = async () => {
    if (!selectedVideo) return;
    
    setPageState("analyzing");
    setDuration(selectedVideo.duration);
    setError(null);

    try {
      const data = await submitPitchAnalysis({
        blob: selectedVideo.blob,
        duration: selectedVideo.duration,
        mode: "one_minute_challenge",
        videoId: selectedVideo.id,
        userName: userName.trim() || undefined,
      });
      setAnalysis(data.analysis);
      setPitchScore(data.score);
      setSavedToLeaderboard(data.savedToLeaderboard || false);
      setPageState("results");

      saveUserStats(data.score.composite);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze your pitch. Please try again.");
      setPageState("select-video");
    }
  };

  const cancelSelection = () => {
    setSelectedVideo(null);
    setPageState("intro");
    setError(null);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <h1 className="ml-4 font-semibold">1-Minute Pitch Challenge</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {pageState === "intro" && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Timer className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">1-Minute Pitch Challenge</h2>
              <p className="text-lg text-muted-foreground">
                Can you deliver a compelling pitch in exactly 60 seconds?
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold">60 Seconds</h3>
                  <p className="text-sm text-muted-foreground">
                    Recording stops automatically
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold">Get Ranked</h3>
                  <p className="text-sm text-muted-foreground">
                    See how you compare to others
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Timer className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold">Earn Badges</h3>
                  <p className="text-sm text-muted-foreground">
                    Unlock achievements
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="max-w-sm mx-auto mb-6">
              <label htmlFor="userName" className="block text-sm font-medium mb-2 text-left">
                Your name (for the leaderboard)
              </label>
              <Input
                id="userName"
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mb-4"
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="xl" onClick={startChallenge}>
                Start Challenge
              </Button>
              <span className="text-muted-foreground">or</span>
              <Button
                size="lg"
                variant="outline"
                onClick={loadSavedVideos}
                disabled={loadingVideos}
                className="gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                {loadingVideos ? "Loading..." : "Use Saved Video"}
              </Button>
            </div>

            <div className="mt-8 p-6 bg-secondary/30 rounded-lg text-left">
              <h3 className="font-semibold mb-3">Challenge Tips:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Hook them in the first 10 seconds</li>
                <li>• Focus on ONE key message</li>
                <li>• End with a memorable close</li>
                <li>• Practice makes perfect - try multiple times!</li>
              </ul>
            </div>
          </div>
        )}

        {pageState === "select-video" && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Select a Saved Video</h2>
              <p className="text-muted-foreground">
                Choose a video between 45-60 seconds from your browser storage
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-center">
                {error}
              </div>
            )}

            {savedVideos.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No eligible videos found</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Videos must be between 45-60 seconds for the 1-minute challenge
                </p>
                <Button onClick={() => setPageState("intro")}>
                  Go Back
                </Button>
              </div>
            ) : selectedVideo ? (
              <div className="space-y-6">
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-black">
                    <video
                      src={URL.createObjectURL(selectedVideo.blob)}
                      controls
                      className="w-full h-full"
                    />
                  </div>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {new Date(selectedVideo.createdAt).toLocaleDateString()} at{" "}
                          {new Date(selectedVideo.createdAt).toLocaleTimeString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedVideo.duration}s • {formatStorageSize(selectedVideo.blob.size)}
                          {selectedVideo.analyzed && selectedVideo.score && (
                            <span className="ml-2">• Previous score: {selectedVideo.score}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="max-w-sm mx-auto">
                  <label htmlFor="userName2" className="block text-sm font-medium mb-2 text-left">
                    Your name (for the leaderboard)
                  </label>
                  <Input
                    id="userName2"
                    type="text"
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="mb-4"
                  />
                </div>

                <div className="flex gap-4 justify-center">
                  <Button variant="outline" onClick={() => setSelectedVideo(null)}>
                    Choose Different Video
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={submitSelectedVideo} 
                    className="gap-2"
                    disabled={!userName.trim()}
                  >
                    <Play className="w-4 h-4" />
                    Analyze This Video
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {savedVideos.map((video) => (
                    <Card
                      key={video.id}
                      className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                      onClick={() => selectVideo(video)}
                    >
                      <div className="aspect-video bg-muted relative">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {video.duration}s
                        </div>
                        {video.analyzed && video.score && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                            Score: {video.score}
                          </div>
                        )}
                      </div>
                      <CardContent className="pt-3 pb-3">
                        <p className="text-sm font-medium">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatStorageSize(video.blob.size)}
                          {video.mode === "one_minute_challenge" && " • Challenge"}
                          {video.mode === "free_pitch" && " • Free Pitch"}
                          {video.mode === "qa_practice" && " • Q&A"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={cancelSelection} className="gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {pageState === "record" && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Your 60 Seconds Starts Now</h2>
              <p className="text-muted-foreground">
                Make every second count!
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-center">
                {error}
              </div>
            )}

            <VideoRecorder
              maxDuration={60}
              onRecordingComplete={handleRecordingComplete}
              mode="challenge"
            />
          </div>
        )}

        {pageState === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing your pitch...</h2>
            <p className="text-muted-foreground">
              Compressing video, then analyzing your score
            </p>
          </div>
        )}

        {pageState === "results" && analysis && pitchScore && (
          <div className="max-w-4xl mx-auto">
            {savedToLeaderboard && (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Your score has been saved to the leaderboard!</span>
              </div>
            )}
            <ResultsDisplay
              analysis={analysis}
              pitchScore={pitchScore}
              duration={duration}
              mode="one_minute_challenge"
              onRetry={handleRetry}
              userName={userName || undefined}
            />
          </div>
        )}
      </main>
    </div>
  );
}
