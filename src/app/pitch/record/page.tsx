"use client";

import { useState } from "react";
import Link from "next/link";
import { VideoRecorder } from "@/components/video-recorder";
import { ResultsDisplay } from "@/components/results-display";
import { SavedVideos } from "@/components/saved-videos";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InterhumanAnalysisResponse, PitchScore } from "@/types";
import { StoredVideo, updateVideoAnalyzed } from "@/lib/video-storage";
import { submitPitchAnalysis } from "@/lib/submit-pitch-analysis";
import { formatCompressionStatus } from "@/lib/video-compression";
import { ArrowLeft, Loader2 } from "lucide-react";

type PageState = "record" | "analyzing" | "results";

export default function RecordPitchPage() {
  const [pageState, setPageState] = useState<PageState>("record");
  const [analysis, setAnalysis] = useState<InterhumanAnalysisResponse | null>(null);
  const [pitchScore, setPitchScore] = useState<PitchScore | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [compressStatus, setCompressStatus] = useState<string | null>(null);

  const analyzeVideo = async (blob: Blob, recordedDuration: number, videoId?: string) => {
    setPageState("analyzing");
    setDuration(recordedDuration);
    setError(null);
    setCompressStatus(null);
    setCurrentVideoId(videoId || null);
    setCurrentVideoBlob(blob);

    try {
      const data = await submitPitchAnalysis({
        blob,
        duration: recordedDuration,
        mode: "free_pitch",
        videoId,
        onCompressProgress: (update) =>
          setCompressStatus(formatCompressionStatus(update)),
      });
      setAnalysis(data.analysis);
      setPitchScore(data.score);
      setPageState("results");

      // Update the stored video with the full results
      if (videoId && data.score) {
        try {
          await updateVideoAnalyzed(videoId, data.score.composite, {
            pitchScore: data.score,
            signals: data.analysis.signals || [],
          });
        } catch {
          // Non-critical, continue
        }
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze your pitch. Please try again.");
      setPageState("record");
    }
  };

  const handleRecordingComplete = async (blob: Blob, recordedDuration: number, videoId?: string) => {
    await analyzeVideo(blob, recordedDuration, videoId);
  };

  const handleSavedVideoSelect = async (video: StoredVideo) => {
    // If video has stored results, show them directly
    if (video.analyzed && video.analysisResult) {
      setDuration(video.duration);
      setPitchScore(video.analysisResult.pitchScore as PitchScore);
      setAnalysis({
        signals: video.analysisResult.signals,
        engagement_states: [],
      } as InterhumanAnalysisResponse);
      setCurrentVideoId(video.id);
      setCurrentVideoBlob(video.blob);
      setPageState("results");
    } else {
      // Otherwise, re-analyze
      await analyzeVideo(video.blob, video.duration, video.id);
    }
  };

  const handleViewResults = (video: StoredVideo) => {
    if (video.analysisResult) {
      setDuration(video.duration);
      setPitchScore(video.analysisResult.pitchScore as PitchScore);
      setAnalysis({
        signals: video.analysisResult.signals,
        engagement_states: [],
      } as InterhumanAnalysisResponse);
      setCurrentVideoId(video.id);
      setCurrentVideoBlob(video.blob);
      setPageState("results");
    }
  };

  const handleRetry = () => {
    setPageState("record");
    setAnalysis(null);
    setPitchScore(null);
    setCurrentVideoId(null);
    setCurrentVideoBlob(null);
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
          <h1 className="ml-4 font-semibold">Record Your Pitch</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {pageState === "record" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Practice Your Pitch</h2>
              <p className="text-muted-foreground">
                Record a 1-3 minute pitch and get AI-powered feedback on your
                delivery.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-center">
                {error}
              </div>
            )}

            <Tabs defaultValue="record" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
                <TabsTrigger value="record">Record New</TabsTrigger>
                <TabsTrigger value="saved">Saved Videos</TabsTrigger>
              </TabsList>

              <TabsContent value="record">
                <div className="max-w-3xl mx-auto">
                  <VideoRecorder
                    maxDuration={180}
                    onRecordingComplete={handleRecordingComplete}
                    mode="free"
                    pitchMode="free_pitch"
                    autoSave={true}
                  />

                  <div className="mt-8 p-6 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-3">Tips for a great pitch:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Start with a compelling hook that grabs attention</li>
                      <li>• Clearly state the problem you&apos;re solving</li>
                      <li>• Explain your solution and why it&apos;s unique</li>
                      <li>• Share traction or validation you&apos;ve achieved</li>
                      <li>• End with a clear ask</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="saved">
                <SavedVideos 
                  onSelectVideo={handleSavedVideoSelect} 
                  onViewResults={handleViewResults}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {pageState === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing your pitch...</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {compressStatus || "Preparing video for upload…"}
            </p>
            <p className="text-muted-foreground">
              Then running analysis (usually 30–60 seconds)
            </p>
          </div>
        )}

        {pageState === "results" && analysis && pitchScore && (
          <div className="max-w-4xl mx-auto">
            <ResultsDisplay
              analysis={analysis}
              pitchScore={pitchScore}
              duration={duration}
              mode="free_pitch"
              videoBlob={currentVideoBlob || undefined}
              onRetry={handleRetry}
            />
          </div>
        )}
      </main>
    </div>
  );
}
