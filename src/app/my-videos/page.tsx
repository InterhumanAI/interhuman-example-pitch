"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAllVideos,
  deleteVideo,
  StoredVideo,
  formatStorageSize,
  getStorageUsage,
} from "@/lib/video-storage";
import {
  Play,
  Trash2,
  Video,
  ArrowLeft,
  Download,
  Calendar,
  Clock,
  Trophy,
  AlertCircle,
} from "lucide-react";

export default function MyVideosPage() {
  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageUsage, setStorageUsage] = useState<{ used: number; count: number } | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<StoredVideo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const allVideos = await getAllVideos();
      setVideos(allVideos);
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    
    setDeleting(id);
    try {
      await deleteVideo(id);
      setVideos(videos.filter((v) => v.id !== id));
      if (selectedVideo?.id === id) {
        setSelectedVideo(null);
      }
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error("Failed to delete video:", error);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (video: StoredVideo) => {
    const url = URL.createObjectURL(video.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pitch-${new Date(video.createdAt).toISOString().split("T")[0]}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const modeLabels: Record<string, string> = {
    free_pitch: "Free Pitch",
    one_minute_challenge: "1-Minute Challenge",
    qa_practice: "Q&A Practice",
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Saved Videos</h1>
            <p className="text-muted-foreground text-sm">
              Videos are stored locally in your browser
            </p>
          </div>
        </div>

        {storageUsage && (
          <div className="mb-6 p-4 bg-secondary/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Video className="w-4 h-4" />
              <span>
                {storageUsage.count} video{storageUsage.count !== 1 ? "s" : ""} •{" "}
                {formatStorageSize(storageUsage.used)} used
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span>Clearing browser data will delete these videos</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No saved videos</h2>
            <p className="text-muted-foreground mb-6">
              Record a pitch to save it locally for later viewing
            </p>
            <Button asChild>
              <Link href="/pitch/record">Record Your First Pitch</Link>
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {selectedVideo ? (
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-black">
                    <video
                      key={selectedVideo.id}
                      src={URL.createObjectURL(selectedVideo.blob)}
                      controls
                      autoPlay
                      className="w-full h-full"
                    />
                  </div>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {modeLabels[selectedVideo.mode] || "Pitch"}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(selectedVideo.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {selectedVideo.duration}s
                          </span>
                          <span>{formatStorageSize(selectedVideo.blob.size)}</span>
                        </div>
                        {selectedVideo.analyzed && selectedVideo.score && (
                          <div className="flex items-center gap-1 mt-2 text-primary">
                            <Trophy className="w-4 h-4" />
                            <span className="font-medium">Score: {selectedVideo.score}</span>
                          </div>
                        )}
                        {selectedVideo.questionText && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            Q: {selectedVideo.questionText}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(selectedVideo)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(selectedVideo.id)}
                          disabled={deleting === selectedVideo.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a video to play</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {videos.map((video) => (
                <Card
                  key={video.id}
                  className={`cursor-pointer transition-colors overflow-hidden ${
                    selectedVideo?.id === video.id
                      ? "border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="flex gap-3 p-3">
                    <div className="w-24 h-16 bg-muted rounded overflow-hidden shrink-0 relative">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                        {video.duration}s
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {modeLabels[video.mode] || "Pitch"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                      {video.analyzed && video.score && (
                        <p className="text-xs text-primary mt-1">
                          Score: {video.score}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
