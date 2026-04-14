"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalEntry, SIGNAL_LABELS } from "@/types";
import { formatDuration } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SignalTimelineProps {
  signals: SignalEntry[];
  duration: number;
  videoBlob?: Blob;
  className?: string;
}

export function SignalTimeline({
  signals,
  duration,
  videoBlob,
  className,
}: SignalTimelineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoBlob]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const seekToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const signalMarkers = useMemo(() => {
    return signals.map((signal) => ({
      time: (signal.start + signal.end) / 2,
      start: signal.start,
      end: signal.end,
      type: signal.type,
      label: SIGNAL_LABELS[signal.type],
      probability: signal.probability,
      rationale: signal.rationale,
    }));
  }, [signals]);

  // Group signals by type for the visual overview
  const signalsByType = useMemo(() => {
    const grouped: Record<string, typeof signalMarkers> = {};
    signalMarkers.forEach((marker) => {
      if (!grouped[marker.type]) {
        grouped[marker.type] = [];
      }
      grouped[marker.type].push(marker);
    });
    return grouped;
  }, [signalMarkers]);

  // Calculate playhead position as percentage
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Timeline Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Signal Timeline */}
        <TooltipProvider delayDuration={100}>
          <div className="space-y-2">
            {/* Time axis */}
            <div className="flex items-center gap-2">
              <div className="w-24" />
              <div className="flex-1 flex justify-between text-xs text-muted-foreground">
                <span>0:00</span>
                <span>{formatDuration(duration / 2)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
            
            {/* Signal bars */}
            <div className="space-y-1.5">
              {Object.entries(signalsByType).map(([type, markers]) => {
                const label = SIGNAL_LABELS[type];
                const isPositive = label?.positive ?? true;
                
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-24 text-xs truncate flex items-center gap-1">
                      <span>{label?.emoji}</span>
                      <span className="truncate">{label?.label || type}</span>
                    </div>
                    <div className="flex-1 h-6 bg-secondary/50 rounded relative">
                      {/* Playhead line inside each bar */}
                      {videoUrl && (
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                          style={{ left: `${playheadPosition}%` }}
                        />
                      )}
                      {markers.map((marker, i) => {
                        const leftPercent = (marker.start / duration) * 100;
                        const widthPercent = ((marker.end - marker.start) / duration) * 100;
                        return (
                          <UITooltip key={i}>
                            <TooltipTrigger asChild>
                              <button
                                className={`absolute h-full rounded cursor-pointer hover:opacity-80 transition-opacity ${
                                  isPositive 
                                    ? "bg-green-500/70 dark:bg-green-500/50 hover:bg-green-500/90" 
                                    : "bg-orange-500/70 dark:bg-orange-500/50 hover:bg-orange-500/90"
                                }`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${Math.max(widthPercent, 2)}%`,
                                }}
                                onClick={() => seekToTime(marker.start)}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-medium flex items-center gap-1">
                                  <span>{label?.emoji}</span>
                                  <span>{label?.label || type}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDuration(marker.start)} - {formatDuration(marker.end)}
                                </div>
                                {marker.rationale && (
                                  <p className="text-xs border-t pt-1 mt-1">
                                    {marker.rationale}
                                  </p>
                                )}
                                {videoUrl && (
                                  <p className="text-xs text-primary">Click to jump to this moment</p>
                                )}
                              </div>
                            </TooltipContent>
                          </UITooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {signals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No signals detected in this recording
              </p>
            )}
          </div>
        </TooltipProvider>

        {/* Video Player */}
        {videoUrl && (
          <div className="border-t pt-4">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full max-w-lg mx-auto rounded-lg"
            />
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/70" />
            <span className="text-muted-foreground">Positive signals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-500/70" />
            <span className="text-muted-foreground">Areas to improve</span>
          </div>
          {videoUrl && (
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-primary" />
              <span className="text-muted-foreground">Current position</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
