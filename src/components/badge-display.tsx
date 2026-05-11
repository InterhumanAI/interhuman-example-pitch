"use client";

import { useState } from "react";
import { Badge } from "@/types";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function generateShareImageUrl(params: {
  score: number;
  percentile: number;
  badges: Badge[];
  userName?: string;
  breakdown?: {
    authority: number;
    clarity: number;
    energy: number;
    confidence: number;
    lowHesitation: number;
  };
  mode?: string;
  hasConversationQuality?: boolean;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("score", params.score.toString());
  searchParams.set("percentile", params.percentile.toString());
  if (params.userName) searchParams.set("name", params.userName);
  if (params.mode) searchParams.set("mode", params.mode);
  if (params.badges.length > 0) {
    searchParams.set("badges", params.badges.map((b) => b.id).join(","));
  }
  if (params.breakdown && params.hasConversationQuality !== false) {
    searchParams.set("authority", params.breakdown.authority.toString());
    searchParams.set("clarity", params.breakdown.clarity.toString());
    searchParams.set("energy", params.breakdown.energy.toString());
    searchParams.set("confidence", params.breakdown.confidence.toString());
  }
  if (params.hasConversationQuality === false) {
    searchParams.set("signalsOnly", "true");
  }
  return `/api/share/image?${searchParams.toString()}`;
}

interface ShareImagePreviewProps {
  score: number;
  percentile: number;
  badges: Badge[];
  userName?: string;
  breakdown?: {
    authority: number;
    clarity: number;
    energy: number;
    confidence: number;
    lowHesitation: number;
  };
  mode?: "free_pitch" | "one_minute_challenge" | "qa_practice";
  hasConversationQuality?: boolean;
  className?: string;
}

export function ShareImagePreview({
  score,
  percentile,
  badges,
  userName = "Founder",
  breakdown,
  mode = "free_pitch",
  hasConversationQuality = true,
  className,
}: ShareImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareImageUrl = generateShareImageUrl({
    score,
    percentile,
    badges,
    userName,
    breakdown,
    mode,
    hasConversationQuality,
  });

  // Generate shareable page URL with encoded data
  const generateSharePageUrl = () => {
    const shareData = {
      score,
      percentile,
      userName,
      authority: breakdown?.authority || 0,
      clarity: breakdown?.clarity || 0,
      energy: breakdown?.energy || 0,
      confidence: breakdown?.confidence || 0,
      mode,
    };
    const encoded = btoa(JSON.stringify(shareData));
    return `${window.location.origin}/share/${encoded}`;
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(shareImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);

      const link = document.createElement("a");
      link.href = url;
      link.download = `pitch-score-${score}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareLinkedIn = () => {
    const shareUrl = generateSharePageUrl();
    const text = `I just scored ${score} on my pitch practice with ${APP_NAME}! 🎯 Top ${Math.max(1, 100 - percentile)}% of founders using Interhuman AI's social signal analysis API.\n\n${shareUrl}`;
    // Use LinkedIn's post creation URL which supports pre-filled text
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    window.open(linkedInUrl, "_blank", "width=600,height=600");
  };

  const handleShareTwitter = () => {
    const shareUrl = generateSharePageUrl();
    const text = `I just scored ${score} on my pitch practice with ${APP_NAME} using Interhuman AI's social signal analysis API! 🎯 Top ${Math.max(1, 100 - percentile)}% of founders.`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const handleCopyLink = async () => {
    const shareUrl = generateSharePageUrl();
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative aspect-[1200/630] w-full max-w-2xl mx-auto rounded-lg overflow-hidden border bg-slate-900">
        {imageUrl ? (
          <img src={imageUrl} alt="Share card preview" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={shareImageUrl}
              alt="Share card preview"
              className="w-full h-full object-cover"
              onLoad={() => setImageUrl(shareImageUrl)}
            />
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Download PNG
        </button>
        <button
          onClick={handleShareLinkedIn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0077b5] text-white hover:bg-[#006699]"
        >
          Share on LinkedIn
        </button>
        <button
          onClick={handleShareTwitter}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
        >
          Share on X
        </button>
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary"
        >
          {copied ? "Copied!" : "Copy Share Link"}
        </button>
      </div>
    </div>
  );
}
