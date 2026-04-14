"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  TrendingUp,
  Lightbulb,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Trophy,
  BookOpen,
  PenLine,
  Sparkles,
} from "lucide-react";

interface QuestionExample {
  id: string;
  question: string;
  category: "prevention" | "promotion";
  topic: string;
  defensiveAnswer?: string;
  promotionAnswer: string;
}

const QUESTION_EXAMPLES: QuestionExample[] = [
  {
    id: "1",
    question: "How long will it take you to break even?",
    category: "prevention",
    topic: "Financials",
    defensiveAnswer: "We're being careful with spending and should break even in 18 months if things go well...",
    promotionAnswer: "Our path to profitability accelerates as we scale. We'll hit break-even at 10K users, and our growth trajectory puts us there in 12 months. Beyond that, each user adds $X to the bottom line.",
  },
  {
    id: "2",
    question: "What if you can't hit your targets?",
    category: "prevention",
    topic: "Financials",
    defensiveAnswer: "We have contingency plans and can cut costs if needed...",
    promotionAnswer: "Our targets are based on conservative assumptions. Even at 70% of projections, we're building a $50M business. And our early traction suggests we're more likely to exceed than miss.",
  },
  {
    id: "3",
    question: "How will you defend against competitors?",
    category: "prevention",
    topic: "Competition",
    defensiveAnswer: "We're watching them closely and will respond to any threats...",
    promotionAnswer: "We're not playing defense - we're defining the category. Our 18-month head start and proprietary technology mean competitors are chasing our roadmap, not the other way around.",
  },
  {
    id: "4",
    question: "What are the biggest risks?",
    category: "prevention",
    topic: "General",
    defensiveAnswer: "Market adoption could be slower than expected, and we might face regulatory challenges...",
    promotionAnswer: "The biggest opportunity is the $10B market shift happening right now. We're positioned to capture it because of our unique approach. The risk is moving too slowly, not too fast.",
  },
  {
    id: "5",
    question: "What happens if a big player enters your market?",
    category: "prevention",
    topic: "Competition",
    defensiveAnswer: "We'd have to differentiate more and possibly pivot to a niche...",
    promotionAnswer: "Big players entering validates the market opportunity. Our focus and speed give us advantages they can't match. We'll have captured the most valuable customers before they even ship.",
  },
  {
    id: "6",
    question: "How will you manage cash burn?",
    category: "prevention",
    topic: "Financials",
    defensiveAnswer: "We're keeping expenses low and have 18 months of runway...",
    promotionAnswer: "Every dollar we spend generates $3 in pipeline. Our unit economics are strong and improving. We're investing in growth, not burning cash - there's a crucial difference.",
  },
  {
    id: "7",
    question: "What keeps you up at night about this business?",
    category: "prevention",
    topic: "General",
    defensiveAnswer: "I worry about execution risk and whether we can hire fast enough...",
    promotionAnswer: "What keeps me up is the excitement of the opportunity ahead. We're at an inflection point where the right moves now could define the next decade of this industry.",
  },
  {
    id: "8",
    question: "How big can this market get?",
    category: "promotion",
    topic: "Market",
    promotionAnswer: "We're targeting a $50B market that's growing 25% annually. But the real opportunity is the adjacent markets we can expand into - that's another $100B.",
  },
  {
    id: "9",
    question: "What's your unfair advantage?",
    category: "promotion",
    topic: "Product",
    promotionAnswer: "Our founding team built the category-defining product at [Previous Company]. We have relationships with 50 enterprise buyers who are waiting for us to launch.",
  },
  {
    id: "10",
    question: "How will you acquire customers at scale?",
    category: "promotion",
    topic: "Market",
    promotionAnswer: "Our product-led growth engine is already working - 40% of users invite colleagues within the first week. Combined with our enterprise sales motion, we have multiple paths to scale.",
  },
];

type PracticeMode = "learn" | "identify" | "reframe";
type PageState = "select" | "practice" | "results";

export default function QAPracticePage() {
  const [pageState, setPageState] = useState<PageState>("select");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("learn");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [userGuess, setUserGuess] = useState<"prevention" | "promotion" | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());

  const preventionQuestions = QUESTION_EXAMPLES.filter(q => q.category === "prevention");
  const allQuestions = QUESTION_EXAMPLES;
  
  const currentQuestions = practiceMode === "learn" ? preventionQuestions : allQuestions;
  const currentQuestion = currentQuestions[currentIndex];

  const handleStartPractice = () => {
    setPageState("practice");
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserAnswer("");
    setUserGuess(null);
    setScore({ correct: 0, total: 0 });
    setCompletedQuestions(new Set());
  };

  const handleNext = () => {
    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setUserAnswer("");
      setUserGuess(null);
    } else {
      setPageState("results");
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setUserAnswer("");
      setUserGuess(null);
    }
  };

  const handleIdentifyGuess = (guess: "prevention" | "promotion") => {
    setUserGuess(guess);
    const isCorrect = guess === currentQuestion.category;
    if (!completedQuestions.has(currentQuestion.id)) {
      setScore(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
      setCompletedQuestions(prev => new Set(prev).add(currentQuestion.id));
    }
  };

  const handleRestart = () => {
    setPageState("select");
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserAnswer("");
    setUserGuess(null);
    setScore({ correct: 0, total: 0 });
    setCompletedQuestions(new Set());
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <h1 className="ml-4 font-semibold">Q&A Practice</h1>
          </div>
          {pageState === "practice" && (
            <div className="text-sm text-muted-foreground">
              {currentIndex + 1} / {currentQuestions.length}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {pageState === "select" && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Master Investor Questions</h2>
              <p className="text-muted-foreground">
                Learn to identify and reframe prevention-focused questions with
                promotion-focused answers. Research shows this skill can help founders raise 7x more.
              </p>
            </div>

            <Tabs
              defaultValue="learn"
              value={practiceMode}
              onValueChange={(v) => setPracticeMode(v as PracticeMode)}
              className="mb-8"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="learn" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Learn
                </TabsTrigger>
                <TabsTrigger value="identify" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Identify
                </TabsTrigger>
                <TabsTrigger value="reframe" className="gap-2">
                  <PenLine className="w-4 h-4" />
                  Reframe
                </TabsTrigger>
              </TabsList>

              <TabsContent value="learn" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Study Examples</p>
                        <p className="text-sm text-muted-foreground">
                          Review prevention questions and see how to reframe them with
                          promotion-focused answers. Compare defensive vs. growth-oriented responses.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="identify" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Eye className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Spot the Type</p>
                        <p className="text-sm text-muted-foreground">
                          Test your ability to identify whether a question is prevention-focused
                          (risk/loss) or promotion-focused (growth/gains).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reframe" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <PenLine className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Practice Reframing</p>
                        <p className="text-sm text-muted-foreground">
                          Write your own promotion-focused answers to prevention questions,
                          then compare with expert examples.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="text-center">
              <Button size="xl" onClick={handleStartPractice}>
                Start Practice
              </Button>
            </div>

            <Card className="mt-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Why This Matters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-orange-700 dark:text-orange-400">Prevention Questions</p>
                      <p className="text-muted-foreground">Focus on risks, losses, and what could go wrong. Often asked unconsciously based on bias.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Promotion Questions</p>
                      <p className="text-muted-foreground">Focus on growth, gains, and opportunity. The answers investors want to hear.</p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground pt-2 border-t">
                  <strong className="text-foreground">Key insight:</strong> Founders who reframe prevention questions 
                  with promotion-focused answers raise <span className="text-primary font-bold">7x more money</span>.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {pageState === "practice" && currentQuestion && (
          <div className="max-w-2xl mx-auto">
            <Progress 
              value={((currentIndex + 1) / currentQuestions.length) * 100} 
              className="mb-8 h-2"
            />

            {/* Learn Mode */}
            {practiceMode === "learn" && (
              <div className="space-y-6">
                <div className="text-center mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    <Shield className="w-4 h-4" />
                    Prevention Question • {currentQuestion.topic}
                  </span>
                </div>

                <Card>
                  <CardContent className="py-8">
                    <p className="text-2xl font-medium text-center">
                      &quot;{currentQuestion.question}&quot;
                    </p>
                  </CardContent>
                </Card>

                {currentQuestion.defensiveAnswer && (
                  <Card className="border-orange-200 dark:border-orange-900/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                        <XCircle className="w-4 h-4" />
                        Defensive Answer (Avoid This)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground italic">
                        &quot;{currentQuestion.defensiveAnswer}&quot;
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Promotion Reframe (Use This)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      &quot;{currentQuestion.promotionAnswer}&quot;
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Identify Mode */}
            {practiceMode === "identify" && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="py-8">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {currentQuestion.topic}
                    </p>
                    <p className="text-2xl font-medium text-center">
                      &quot;{currentQuestion.question}&quot;
                    </p>
                  </CardContent>
                </Card>

                {!userGuess ? (
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground">
                      Is this a prevention or promotion question?
                    </p>
                    <div className="flex gap-4 justify-center">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleIdentifyGuess("prevention")}
                        className="gap-2 flex-1 max-w-[200px]"
                      >
                        <Shield className="w-4 h-4 text-orange-500" />
                        Prevention
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleIdentifyGuess("promotion")}
                        className="gap-2 flex-1 max-w-[200px]"
                      >
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Promotion
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Card className={userGuess === currentQuestion.category 
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
                    : "border-red-500 bg-red-50 dark:bg-red-900/20"
                  }>
                    <CardContent className="py-6">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        {userGuess === currentQuestion.category ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <span className="font-semibold text-green-700 dark:text-green-400">Correct!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-6 h-6 text-red-600" />
                            <span className="font-semibold text-red-700 dark:text-red-400">Not quite</span>
                          </>
                        )}
                      </div>
                      <p className="text-center text-sm">
                        This is a <strong className={currentQuestion.category === "prevention" ? "text-orange-600" : "text-green-600"}>
                          {currentQuestion.category}
                        </strong> question.
                        {currentQuestion.category === "prevention" && (
                          <span className="block mt-2 text-muted-foreground">
                            It focuses on risks and potential losses rather than growth opportunities.
                          </span>
                        )}
                        {currentQuestion.category === "promotion" && (
                          <span className="block mt-2 text-muted-foreground">
                            It focuses on growth, gains, and future opportunities.
                          </span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {userGuess && (
                  <div className="text-center text-sm text-muted-foreground">
                    Score: {score.correct} / {score.total} correct
                  </div>
                )}
              </div>
            )}

            {/* Reframe Mode */}
            {practiceMode === "reframe" && (
              <div className="space-y-6">
                <div className="text-center mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    <Shield className="w-4 h-4" />
                    Prevention Question • {currentQuestion.topic}
                  </span>
                </div>

                <Card>
                  <CardContent className="py-8">
                    <p className="text-2xl font-medium text-center">
                      &quot;{currentQuestion.question}&quot;
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Write a promotion-focused answer:
                  </label>
                  <Textarea
                    placeholder="Reframe this with a growth and opportunity focus..."
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="w-full gap-2"
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAnswer ? "Hide" : "Show"} Example Answer
                </Button>

                {showAnswer && (
                  <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Example Promotion Reframe
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        &quot;{currentQuestion.promotionAnswer}&quot;
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button onClick={handleNext} className="gap-2">
                {currentIndex === currentQuestions.length - 1 ? "Finish" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {pageState === "results" && (
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Practice Complete!</h2>
            
            {practiceMode === "identify" && (
              <Card className="mb-6">
                <CardContent className="py-6">
                  <p className="text-4xl font-bold text-primary mb-2">
                    {Math.round((score.correct / score.total) * 100)}%
                  </p>
                  <p className="text-muted-foreground">
                    {score.correct} of {score.total} questions identified correctly
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="text-muted-foreground mb-8">
              {practiceMode === "learn" && "You've reviewed all the prevention question examples and their promotion reframes."}
              {practiceMode === "identify" && score.correct === score.total && "Perfect score! You can spot question types like a pro."}
              {practiceMode === "identify" && score.correct !== score.total && "Keep practicing to improve your ability to spot question types."}
              {practiceMode === "reframe" && "Great practice! Remember to always pivot to growth and opportunity."}
            </p>

            <div className="flex flex-col gap-3">
              <Button onClick={handleRestart} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Practice Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/challenge">Try the 1-Minute Challenge</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
