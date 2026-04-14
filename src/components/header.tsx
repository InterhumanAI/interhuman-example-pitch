"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-primary" />
          <span className="font-bold text-xl">PitchPerfect</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/challenge"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            1-Minute Challenge
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Leaderboard
          </Link>
          <Link
            href="/my-videos"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            My Videos
          </Link>
        </nav>
        <Button asChild>
          <Link href="/pitch/record">Start Practicing</Link>
        </Button>
      </div>
    </header>
  );
}
