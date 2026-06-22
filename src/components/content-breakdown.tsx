"use client";

import { useState } from "react";
import {
  ContentScore,
  CONTENT_DIMENSION_LABELS,
  ContentDimensionKey,
} from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileText, Lightbulb } from "lucide-react";

interface ContentBreakdownProps {
  content: ContentScore;
  composite: number;
  deliveryComposite: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const DIMENSION_ORDER: ContentDimensionKey[] = [
  "messageClarity",
  "problemFraming",
  "solutionValue",
  "evidenceSpecificity",
  "narrativeStructure",
  "theAsk",
];

export function ContentBreakdown({
  content,
  composite,
  deliveryComposite,
}: ContentBreakdownProps) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const { speechMetrics } = content;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h3 className="text-2xl font-bold">Content Analysis</h3>
        <p className="text-muted-foreground text-sm mt-1">
          How the substance of what you said scored
        </p>
      </div>

      {/* Three composites: overall / delivery / content */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Overall", value: composite, emphasis: true },
          { label: "Delivery", value: deliveryComposite, emphasis: false },
          { label: "Content", value: content.contentComposite, emphasis: false },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6 text-center">
              <div
                className={
                  s.emphasis
                    ? "text-4xl font-bold text-primary"
                    : "text-3xl font-bold"
                }
              >
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      {content.summary && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed">{content.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Speech metric chips */}
      <div className="flex flex-wrap justify-center gap-3">
        <Chip label="Pace" value={`${speechMetrics.wordsPerMinute} wpm`} />
        <Chip
          label="Filler words"
          value={`${speechMetrics.fillerDensity}/100 words`}
        />
      </div>

      {/* Per-dimension cards */}
      <div className="space-y-4">
        {DIMENSION_ORDER.map((key) => {
          const dim = content.dimensions[key];
          if (!dim) return null;
          const meta = CONTENT_DIMENSION_LABELS[key];
          return (
            <Card key={key}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {dim.score}
                  </span>
                </div>
                <Progress
                  value={dim.score}
                  indicatorClassName={scoreColor(dim.score)}
                />
                <p className="text-sm text-muted-foreground">{dim.rationale}</p>
                {dim.tips.length > 0 && (
                  <ul className="space-y-1">
                    {dim.tips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Collapsible transcript */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
            onClick={() => setTranscriptOpen((o) => !o)}
          >
            <span className="flex items-center gap-2 font-medium">
              <FileText className="w-4 h-4" />
              Transcript
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                transcriptOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          {transcriptOpen && (
            <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {content.transcript}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
