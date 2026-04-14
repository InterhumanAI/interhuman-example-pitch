import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/header";
import {
  Video,
  Timer,
  Trophy,
  TrendingUp,
  Shield,
  ArrowRight,
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
              <Button size="xl" variant="outline" asChild>
                <Link href="/challenge" className="gap-2">
                  <Timer className="w-5 h-5" />
                  1-Minute Challenge
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
                  desc: "Record your pitch using your webcam. Practice your full pitch or take the 1-minute challenge.",
                },
                {
                  icon: BarChart3,
                  title: "2. Analyze",
                  desc: "Our AI analyzes your delivery for confidence, clarity, energy, and engagement signals.",
                },
                {
                  icon: Trophy,
                  title: "3. Improve",
                  desc: "Get actionable feedback, earn badges, and track your progress on the leaderboard.",
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

        {/* AI-Powered Feedback */}
        <section className="py-20 bg-secondary/30">
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

        {/* Prevention vs Promotion */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <h2 className="text-3xl font-bold mb-6 leading-tight">
                  Master the Art of Handling Investor Questions
                </h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Research shows that investors ask different types of questions
                  based on unconscious bias. Male founders receive
                  &quot;promotion&quot; questions about growth, while female
                  founders often face &quot;prevention&quot; questions about
                  risks.
                </p>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  <strong className="text-foreground">The key insight:</strong>{" "}
                  Founders who reframe prevention questions with
                  promotion-focused answers raise{" "}
                  <span className="text-primary font-bold">7x more money</span>.
                </p>
                <Button asChild>
                  <Link href="/qa-practice" className="gap-2">
                    Practice Q&A
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <Card className="p-6 bg-secondary/30 border-0">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                      <Shield className="w-5 h-5" />
                      <span className="font-medium text-sm">Prevention Question</span>
                    </div>
                    <p className="text-muted-foreground italic">
                      &quot;How long will it take you to break even?&quot;
                    </p>
                  </div>
                  <div className="border-l-4 border-red-300 pl-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Defensive answer:
                    </p>
                    <p className="text-sm">
                      &quot;We&apos;re being careful with spending and should
                      break even in 18 months if things go well...&quot;
                    </p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <p className="text-xs text-primary mb-1 font-medium">
                      Promotion reframe:
                    </p>
                    <p className="text-sm">
                      &quot;Our path to profitability accelerates as we
                      scale—we&apos;ll hit break-even at 10K users, and our
                      growth trajectory puts us there in 12 months.&quot;
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* 1-Minute Challenge CTA */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <Timer className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <h2 className="text-3xl font-bold mb-4">
              Take the 1-Minute Challenge
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
              Can you deliver a compelling pitch in exactly 60 seconds? Compete
              with other founders and climb the leaderboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/challenge" className="gap-2">
                  Start Challenge
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link href="/leaderboard" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  View Leaderboard
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Perfect Your Pitch?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of founders who have improved their pitch delivery
              and raised more funding.
            </p>
            <Button size="xl" asChild className="shadow-lg shadow-primary/25">
              <Link href="/pitch/record" className="gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold">PitchPerfect</span>
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
