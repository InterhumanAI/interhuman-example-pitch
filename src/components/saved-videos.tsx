"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAllVideos,
  deleteVideo,
  getStorageUsage,
  formatStorageSize,
  StoredVideo,
} from "@/lib/video-storage";
import { formatDuration } from "@/lib/utils";
import { Trash2, Play, Upload, HardDrive, Clock, Calendar, BarChart3, Download } from "lucide-react";

interface SavedVideosProps {
  onSelectVideo?: (video: StoredVideo) => void;
  onViewResults?: (video: StoredVideo) => void;
  className?: string;
}

export function SavedVideos({ onSelectVideo, onViewResults, className }: SavedVideosProps) {
  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [storageUsage, setStorageUsage] = useState({ used: 0, count: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const [allVideos, usage] = await Promise.all([
        getAllVideos(),
        getStorageUsage(),
      ]);
      setVideos(allVideos);
      setStorageUsage(usage);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this video? This cannot be undone.")) return;

    try {
      await deleteVideo(id);
      if (selectedVideoId === id) {
        setSelectedVideoId(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }
      await loadVideos();
    } catch (error) {
      console.error("Failed to delete video:", error);
    }
  };

  const handlePreview = (video: StoredVideo) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(video.blob);
    setPreviewUrl(url);
    setSelectedVideoId(video.id);
  };

  const handleSelect = (video: StoredVideo) => {
    onSelectVideo?.(video);
  };

  const handleDownload = (video: StoredVideo) => {
    const url = URL.createObjectURL(video.blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date(video.createdAt);
    const dateStr = date.toISOString().split("T")[0];
    a.download = `pitch-${getModeLabel(video.mode).toLowerCase().replace(/\s+/g, "-")}-${dateStr}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "free_pitch":
        return "Free Pitch";
      case "one_minute_challenge":
        return "1-Min Challenge";
      case "qa_practice":
        return "Q&A Practice";
      default:
        return mode;
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-muted-foreground">
          Loading saved videos...
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <HardDrive className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No saved videos yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your recorded videos will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Saved Videos</h3>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <HardDrive className="w-4 h-4" />
          {formatStorageSize(storageUsage.used)} ({storageUsage.count} videos)
        </div>
      </div>

      {selectedVideoId && previewUrl && (
        <div className="mb-4">
          <video
            src={previewUrl}
            controls
            className="w-full max-w-md mx-auto rounded-lg"
          />
        </div>
      )}

      <div className="grid gap-3">
        {videos.map((video) => (
          <Card
            key={video.id}
            className={`cursor-pointer transition-colors ${
              selectedVideoId === video.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handlePreview(video)}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-24 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-24 h-14 bg-secondary rounded flex items-center justify-center">
                    <Play className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary">
                      {getModeLabel(video.mode)}
                    </span>
                    {video.analyzed && video.score !== undefined && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        Score: {video.score}
                      </span>
                    )}
                  </div>

                  {video.questionText && (
                    <p className="text-sm text-muted-foreground truncate mb-1">
                      {video.questionText}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(video.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(video.createdAt)}
                    </span>
                    <span>{formatStorageSize(video.blob.size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {video.analyzed && video.analysisResult && onViewResults && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewResults(video);
                      }}
                      className="gap-1"
                    >
                      <BarChart3 className="w-3 h-3" />
                      Results
                    </Button>
                  )}
                  {onSelectVideo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(video);
                      }}
                      className="gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      {video.analyzed ? "Re-analyze" : "Analyze"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(video);
                    }}
                    title="Download video"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(video.id);
                    }}
                    className="text-destructive hover:text-destructive"
                    title="Delete video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
