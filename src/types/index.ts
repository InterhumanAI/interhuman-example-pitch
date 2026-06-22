export type EngagementState = "engaged" | "disengaged" | "neutral";

export type SignalType =
  | "agreement"
  | "confidence"
  | "confusion"
  | "disagreement"
  | "frustration"
  | "hesitation"
  | "interest"
  | "skepticism"
  | "stress"
  | "uncertainty";

export type SignalProbability = "high" | "medium" | "low";

export interface EngagementStateEntry {
  start: number;
  end: number;
  state: EngagementState;
}

export interface SignalEntry {
  start: number;
  end: number;
  type: SignalType;
  probability: SignalProbability;
  rationale: string;
}

export interface ConversationQualityValues {
  quality_index: number;
  energy: number;
  rapport: number;
  authority: number;
  learning: number;
  clarity: number;
}

export interface TimelineEntry {
  start: number;
  end: number;
  values: ConversationQualityValues;
}

export interface InterhumanAnalysisResponse {
  engagement_states?: EngagementStateEntry[];
  engagement_state?: EngagementStateEntry[]; // API sometimes returns singular
  signals: SignalEntry[];
  conversation_quality?: {
    overall: ConversationQualityValues;
    timeline: TimelineEntry[];
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export interface ContentDimension {
  /** 0-100 */
  score: number;
  rationale: string;
  /** 1-2 actionable tips */
  tips: string[];
}

export type ContentDimensionKey =
  | "messageClarity"
  | "problemFraming"
  | "solutionValue"
  | "evidenceSpecificity"
  | "narrativeStructure"
  | "theAsk";

export interface ContentScore {
  /** 0-100, weighted blend of the LLM rubric + speech metrics */
  contentComposite: number;
  transcript: string;
  speechMetrics: {
    wordsPerMinute: number;
    /** fillers per 100 words */
    fillerDensity: number;
    paceScore: number;
    fillerScore: number;
  };
  dimensions: Record<ContentDimensionKey, ContentDimension>;
  /** 1-2 sentence overall content feedback */
  summary: string;
}

export interface PitchScore {
  /** Overall blended score (delivery + content) shown as the headline number */
  composite: number;
  /** Delivery-only composite (the legacy social-signal score) */
  deliveryComposite: number;
  percentile: number;
  breakdown: {
    authority: number;
    clarity: number;
    energy: number;
    confidence: number;
    lowHesitation: number;
  };
  badges: Badge[];
  hasConversationQuality?: boolean;
  hasContentScore?: boolean;
  content?: ContentScore;
}

export const CONTENT_DIMENSION_LABELS: Record<
  ContentDimensionKey,
  { label: string; description: string }
> = {
  messageClarity: {
    label: "Message Clarity",
    description: "How clearly the core idea comes across in words",
  },
  problemFraming: {
    label: "Problem Framing",
    description: "How compellingly the problem is defined",
  },
  solutionValue: {
    label: "Solution & Value",
    description: "How well the solution and its value are articulated",
  },
  evidenceSpecificity: {
    label: "Evidence & Specificity",
    description: "Concrete traction, numbers, and specifics",
  },
  narrativeStructure: {
    label: "Narrative Structure",
    description: "Logical flow and storytelling from hook to close",
  },
  theAsk: {
    label: "The Ask",
    description: "Clarity and strength of the closing ask",
  },
};

export const BADGES: Badge[] = [
  {
    id: "top_10_confidence",
    name: "Top 10% Confidence",
    description: "Authority score in the top 10% of all pitches",
    icon: "🏆",
    requirement: "Authority score > 90th percentile",
  },
  {
    id: "crystal_clear",
    name: "Crystal Clear",
    description: "Exceptional clarity in your pitch",
    icon: "💎",
    requirement: "Clarity score > 85",
  },
  {
    id: "high_energy",
    name: "High Energy Founder",
    description: "Your energy and presence stood out",
    icon: "⚡",
    requirement: "Energy score > 85",
  },
  {
    id: "pitch_perfect",
    name: "Pitch Perfect",
    description: "Outstanding overall performance",
    icon: "🎯",
    requirement: "Overall score > 80",
  },
  {
    id: "bias_buster",
    name: "Bias Buster",
    description: "Master of reframing prevention questions",
    icon: "🛡️",
    requirement: "Successfully reframed 10 prevention questions",
  },
  {
    id: "one_minute_master",
    name: "1-Minute Master",
    description: "Consistent excellence in the challenge",
    icon: "⏱️",
    requirement: "10 challenges with avg score > 70",
  },
];

export const SIGNAL_LABELS: Record<SignalType, { label: string; emoji: string; positive: boolean }> = {
  agreement: { label: "Agreement", emoji: "🤝", positive: true },
  confidence: { label: "Confidence", emoji: "💪", positive: true },
  confusion: { label: "Confusion", emoji: "😕", positive: false },
  disagreement: { label: "Disagreement", emoji: "🤔", positive: false },
  frustration: { label: "Frustration", emoji: "😤", positive: false },
  hesitation: { label: "Hesitation", emoji: "⏸️", positive: false },
  interest: { label: "Interest", emoji: "👀", positive: true },
  skepticism: { label: "Skepticism", emoji: "🧐", positive: false },
  stress: { label: "Stress", emoji: "😰", positive: false },
  uncertainty: { label: "Uncertainty", emoji: "❓", positive: false },
};

export const DIMENSION_LABELS: Record<keyof Omit<ConversationQualityValues, "quality_index">, { label: string; description: string }> = {
  clarity: {
    label: "Clarity",
    description: "How easy it is to follow your message",
  },
  authority: {
    label: "Authority",
    description: "Decisiveness and credibility in your delivery",
  },
  energy: {
    label: "Energy",
    description: "Vitality, responsiveness, and presence",
  },
  rapport: {
    label: "Rapport",
    description: "Warmth, respect, and emotional connection",
  },
  learning: {
    label: "Learning",
    description: "Curiosity and openness to exploration",
  },
};
