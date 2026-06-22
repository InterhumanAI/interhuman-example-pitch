"use client";

import { InterhumanAnalysisResponse, PitchScore } from "@/types";
import { SignalTimeline } from "./signal-timeline";
import { ShareImagePreview } from "./badge-display";
import { ContentBreakdown } from "./content-breakdown";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, AlertCircle } from "lucide-react";

interface ResultsDisplayProps {
  analysis: InterhumanAnalysisResponse;
  pitchScore: PitchScore;
  duration: number;
  mode: "free_pitch" | "one_minute_challenge" | "qa_practice";
  videoBlob?: Blob;
  onRetry?: () => void;
  userName?: string;
}

export function ResultsDisplay({
  analysis,
  pitchScore,
  duration,
  mode,
  videoBlob,
  onRetry,
  userName,
}: ResultsDisplayProps) {
  const signals = analysis.signals || [];
  const hasConversationQuality = pitchScore.hasConversationQuality !== false;
  const hasContentScore = !!pitchScore.hasContentScore && !!pitchScore.content;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">
          {mode === "one_minute_challenge" ? "Challenge Complete!" : "Pitch Analysis"}
        </h2>
        {mode === "one_minute_challenge" && pitchScore.percentile > 0 && hasConversationQuality && (
          <div className="flex items-center justify-center gap-2 text-lg text-primary">
            <Trophy className="w-5 h-5" />
            <span>
              {pitchScore.percentile >= 90
                ? `Top ${Math.max(1, 100 - Math.floor(pitchScore.percentile))}% of founders`
                : `${Math.floor(pitchScore.percentile)}th percentile`}
            </span>
          </div>
        )}
      </div>

      {/* Notice when conversation quality is not available */}
      {!hasConversationQuality && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-2xl mx-auto">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">Limited analysis available</p>
            <p className="text-muted-foreground mt-1">
              Full conversation quality metrics (authority, clarity, energy) could not be computed for this video. 
              Showing social signal analysis instead.
            </p>
          </div>
        </div>
      )}

      {/* Share Card - Front and Center */}
      <div className="flex flex-col items-center">
        <ShareImagePreview
          score={pitchScore.composite}
          percentile={pitchScore.percentile}
          badges={pitchScore.badges}
          userName={userName}
          breakdown={pitchScore.breakdown}
          mode={mode}
          hasConversationQuality={hasConversationQuality}
        />
      </div>

      {/* Visual Timeline Overview with Video */}
      <SignalTimeline
        signals={signals}
        duration={duration}
        videoBlob={videoBlob}
      />

      {/* Content / transcript analysis */}
      {hasContentScore && pitchScore.content ? (
        <ContentBreakdown
          content={pitchScore.content}
          composite={pitchScore.composite}
          deliveryComposite={pitchScore.deliveryComposite}
        />
      ) : (
        <div className="flex items-start gap-3 p-4 bg-muted/50 border rounded-lg max-w-2xl mx-auto">
          <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Content analysis unavailable</p>
            <p className="text-muted-foreground mt-1">
              We couldn&apos;t transcribe and score what you said for this pitch.
              Showing delivery analysis only.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 pt-4">
        <Button variant="outline" size="lg" onClick={onRetry} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
        {mode === "one_minute_challenge" && (
          <Button size="lg" asChild>
            <a href="/leaderboard">View Leaderboard</a>
          </Button>
        )}
      </div>
    </div>
  );
}
