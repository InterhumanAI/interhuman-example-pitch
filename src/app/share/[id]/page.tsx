import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

function decodeShareId(id: string): {
  score: number;
  percentile: number;
  userName: string;
  authority: number;
  clarity: number;
  energy: number;
  confidence: number;
  mode: string;
} | null {
  try {
    const decoded = Buffer.from(id, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  const data = decodeShareId(id);

  if (!data) {
    return {
      title: `${APP_NAME} - Practice Your Pitch`,
      description: "Practice and perfect your investor pitch with AI-powered feedback.",
    };
  }

  const imageUrl = `/api/share/image?score=${data.score}&percentile=${data.percentile}&name=${encodeURIComponent(data.userName)}&authority=${data.authority}&clarity=${data.clarity}&energy=${data.energy}&confidence=${data.confidence}&mode=${data.mode}`;

  const title = `${data.userName} scored ${data.score} on ${APP_NAME} using Interhuman AI's social signal analysis API!`;
  const description = `Top ${Math.max(1, 100 - data.percentile)}% of founders.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${data.userName}'s pitch score: ${data.score}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const scoreData = decodeShareId(id);

  if (!scoreData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Share Link</h1>
          <p className="text-muted-foreground mb-6">This share link is invalid or has expired.</p>
          <Button asChild>
            <Link href="/">Try {APP_NAME}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const modeLabels: Record<string, string> = {
    free_pitch: "Free Pitch",
    one_minute_challenge: "1-Minute Challenge",
    qa_practice: "Q&A Practice",
  };

  const imageUrl = `/api/share/image?score=${scoreData.score}&percentile=${scoreData.percentile}&name=${encodeURIComponent(scoreData.userName)}&authority=${scoreData.authority}&clarity=${scoreData.clarity}&energy=${scoreData.energy}&confidence=${scoreData.confidence}&mode=${scoreData.mode}`;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Try {APP_NAME}
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {scoreData.userName}&apos;s Pitch Score
            </h1>
            <p className="text-muted-foreground">
              {modeLabels[scoreData.mode] || "Pitch Practice"}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-lg text-primary mb-8">
            <Trophy className="w-5 h-5" />
            <span>Top {Math.max(1, 100 - scoreData.percentile)}% of founders</span>
          </div>

          <div className="relative aspect-[1200/630] w-full max-w-2xl mx-auto rounded-lg overflow-hidden border bg-slate-900 mb-8">
            <img
              src={imageUrl}
              alt={`${scoreData.userName}'s pitch score: ${scoreData.score}`}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-4">
            <p className="text-lg">
              Want to practice your pitch and see how you compare?
            </p>
            <Button size="lg" asChild>
              <Link href="/challenge">Take the 1-Minute Challenge</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
