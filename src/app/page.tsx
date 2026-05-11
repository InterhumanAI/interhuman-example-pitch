import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/header";
import { APP_NAME } from "@/lib/brand";
import { VERCEL_DEPLOY_URL } from "@/lib/deploy";
import {
  Video,
  Trophy,
  TrendingUp,
  Sparkles,
  Target,
  Award,
  BarChart3,
  Users,
  Zap,
  CheckCircle,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 via-primary/10 to-background">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Powered by Interhuman AI
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Perfect Your Pitch.
              <br />
              <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                Win More Funding.
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Practice your investor pitch with AI-powered behavioral analysis.
              Get real-time feedback on confidence, clarity, and presence.
              Learn to handle tough questions like a pro.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" asChild className="shadow-lg shadow-primary/25">
                <Link href="/pitch/record" className="gap-2">
                  <Video className="w-5 h-5" />
                  Record Your Pitch
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Video,
                  title: "1. Record",
                  desc: "Record your pitch using your webcam and practice at your own pace.",
                },
                {
                  icon: BarChart3,
                  title: "2. Analyze",
                  desc: "Our AI analyzes your delivery for confidence, clarity, energy, and engagement signals.",
                },
                {
                  icon: Trophy,
                  title: "3. Improve",
                  desc: "Get actionable feedback and track how your delivery improves over time.",
                },
              ].map((item, i) => (
                <Card key={i} className="text-center border-0 shadow-none bg-secondary/30">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Build with Interhuman */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Build with Interhuman
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Turn this example into your own product
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                This app is a starting point for building with Interhuman&apos;s
                behavioral intelligence APIs. Deploy your own copy in minutes,
                connect your API key, and experiment with confidence, clarity,
                and engagement signals in your own workflow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href={VERCEL_DEPLOY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://vercel.com/button"
                    alt="Deploy with Vercel"
                    width={113}
                    height={32}
                  />
                </a>
                <Button variant="outline" size="lg" asChild>
                  <a
                    href="https://docs.interhuman.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the Interhuman docs
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Powered Feedback */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-4">
              AI-Powered Feedback
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Get detailed insights on every aspect of your pitch delivery
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Target, label: "Clarity Score", desc: "How easy is your message to follow?" },
                { icon: Award, label: "Authority", desc: "Do you project confidence and credibility?" },
                { icon: Zap, label: "Energy", desc: "Is your presence engaging and dynamic?" },
                { icon: Users, label: "Rapport", desc: "Do you connect with your audience?" },
                { icon: CheckCircle, label: "Confidence Signals", desc: "Moments of strong conviction" },
                { icon: TrendingUp, label: "Engagement Timeline", desc: "See how attention flows over time" },
              ].map((item, i) => (
                <Card key={i} className="border bg-background">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold">{APP_NAME}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <span>
                Powered by{" "}
                <a
                  href="https://interhuman.ai"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Interhuman AI
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
