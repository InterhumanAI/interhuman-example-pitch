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

export interface PitchScore {
  composite: number;
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
}

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
