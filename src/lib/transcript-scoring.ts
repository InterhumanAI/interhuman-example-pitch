import "server-only";

import type {
  ContentScore,
  ContentDimension,
  ContentDimensionKey,
} from "@/types";
import { chatJson } from "@/lib/openai/client";

export const CONTENT_MODEL = "gpt-4o-mini";

// Multi-word fillers must be matched before single words so the density count
// isn't double-charged (e.g. "you know" shouldn't also count as "know").
const FILLER_PHRASES = ["you know", "i mean", "kind of", "sort of"];
const FILLER_WORDS = ["um", "uh", "like", "so", "basically", "actually", "right"];

// Weights for blending the six LLM rubric dimensions into one rubric score.
const RUBRIC_WEIGHTS: Record<ContentDimensionKey, number> = {
  messageClarity: 0.2,
  problemFraming: 0.15,
  solutionValue: 0.2,
  evidenceSpecificity: 0.2,
  narrativeStructure: 0.15,
  theAsk: 0.1,
};

// How the final content composite blends the LLM rubric with speech metrics.
const CONTENT_WEIGHTS = { rubric: 0.6, pace: 0.2, filler: 0.2 };

const DIMENSION_KEYS: ContentDimensionKey[] = [
  "messageClarity",
  "problemFraming",
  "solutionValue",
  "evidenceSpecificity",
  "narrativeStructure",
  "theAsk",
];

export interface SpeechMetrics {
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  /** fillers per 100 words */
  fillerDensity: number;
  paceScore: number;
  fillerScore: number;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeSpeechMetrics(
  transcript: string,
  durationSeconds: number,
): SpeechMetrics {
  const normalized = transcript.toLowerCase();
  const words = (transcript.trim().match(/\b[\w'-]+\b/g) || []);
  const wordCount = words.length;

  const wordsPerMinute =
    durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;

  let fillerCount = 0;
  for (const phrase of FILLER_PHRASES) {
    const matches = normalized.match(new RegExp(`\\b${phrase}\\b`, "g"));
    if (matches) fillerCount += matches.length;
  }
  for (const word of FILLER_WORDS) {
    const matches = normalized.match(new RegExp(`\\b${word}\\b`, "g"));
    if (matches) fillerCount += matches.length;
  }

  const fillerDensity =
    wordCount > 0 ? Math.round((fillerCount / wordCount) * 1000) / 10 : 0;

  // Pace: triangular curve peaking at ~150 wpm. ±70 wpm off-peak ≈ 30 pts lost.
  const paceScore = clamp(Math.round(100 - Math.abs(wordsPerMinute - 150) * 0.5));

  // Filler: clean delivery = 100; heavy filler floors at 30 (mirrors the
  // lowHesitation floor in scoring.ts).
  const fillerScore = clamp(Math.round(100 - Math.min(70, fillerDensity * 6)));

  return {
    wordCount,
    wordsPerMinute,
    fillerCount,
    fillerDensity,
    paceScore,
    fillerScore,
  };
}

interface RubricResult {
  summary: string;
  dimensions: Record<ContentDimensionKey, ContentDimension>;
}

const DIMENSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "rationale", "tips"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    rationale: { type: "string" },
    tips: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 2,
    },
  },
} as const;

const RUBRIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "dimensions"],
  properties: {
    summary: { type: "string" },
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: DIMENSION_KEYS,
      properties: Object.fromEntries(
        DIMENSION_KEYS.map((k) => [k, DIMENSION_SCHEMA]),
      ),
    },
  },
} as const;

export async function scoreContentWithLLM(args: {
  transcript: string;
  mode: string;
  apiKey: string;
  model: string;
}): Promise<RubricResult> {
  const systemPrompt = [
    "You are an expert startup pitch coach evaluating the TRANSCRIPT of a spoken pitch.",
    "Score ONLY the substance of what was said — the words and ideas — NOT delivery, voice, tone, or body language.",
    "Rate each rubric dimension from 0 to 100, where 50 is an average pitch and 85+ is exceptional.",
    "For each dimension give a concise one-sentence rationale and 1-2 concrete, actionable tips.",
    "Be honest and specific; reward concrete evidence (numbers, traction, names) and penalize vagueness.",
  ].join(" ");

  const userPrompt = [
    `Pitch mode: ${args.mode}.`,
    "Rubric dimensions:",
    "- messageClarity: Is the core idea clear and easy to follow in words?",
    "- problemFraming: Is the problem defined compellingly and credibly?",
    "- solutionValue: Is the solution and its value proposition well articulated?",
    "- evidenceSpecificity: Are there concrete specifics — traction, numbers, proof?",
    "- narrativeStructure: Does it flow logically from hook to close?",
    "- theAsk: Is there a clear, strong closing ask?",
    "",
    "Transcript:",
    '"""',
    args.transcript,
    '"""',
  ].join("\n");

  return chatJson<RubricResult>({
    apiKey: args.apiKey,
    model: args.model,
    systemPrompt,
    userPrompt,
    jsonSchema: RUBRIC_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "pitch_content_score",
  });
}

export async function buildContentScore(args: {
  transcript: string;
  durationSeconds: number;
  mode: string;
  apiKey: string;
}): Promise<ContentScore> {
  const speechMetrics = computeSpeechMetrics(
    args.transcript,
    args.durationSeconds,
  );

  const rubric = await scoreContentWithLLM({
    transcript: args.transcript,
    mode: args.mode,
    apiKey: args.apiKey,
    model: CONTENT_MODEL,
  });

  const llmRubricComposite = DIMENSION_KEYS.reduce(
    (sum, key) => sum + rubric.dimensions[key].score * RUBRIC_WEIGHTS[key],
    0,
  );

  const contentComposite = Math.round(
    CONTENT_WEIGHTS.rubric * llmRubricComposite +
      CONTENT_WEIGHTS.pace * speechMetrics.paceScore +
      CONTENT_WEIGHTS.filler * speechMetrics.fillerScore,
  );

  return {
    contentComposite,
    transcript: args.transcript,
    speechMetrics: {
      wordsPerMinute: speechMetrics.wordsPerMinute,
      fillerDensity: speechMetrics.fillerDensity,
      paceScore: speechMetrics.paceScore,
      fillerScore: speechMetrics.fillerScore,
    },
    dimensions: rubric.dimensions,
    summary: rubric.summary,
  };
}
