import {
  InterhumanAnalysisResponse,
  PitchScore,
  Badge,
  BADGES,
  SignalType,
} from "@/types";

function countSignals(
  signals: InterhumanAnalysisResponse["signals"],
  type: SignalType
): number {
  return signals.filter(
    (s) => s.type === type && (s.probability === "high" || s.probability === "medium")
  ).length;
}

function calculateConfidenceScore(
  signals: InterhumanAnalysisResponse["signals"],
  durationSeconds: number
): number {
  const confidenceCount = countSignals(signals, "confidence");
  const hesitationCount = countSignals(signals, "hesitation");
  const uncertaintyCount = countSignals(signals, "uncertainty");

  const positiveSignals = confidenceCount;
  const negativeSignals = hesitationCount + uncertaintyCount;

  const normalizedPositive = Math.min((positiveSignals / (durationSeconds / 30)) * 50, 50);
  const normalizedNegative = Math.min((negativeSignals / (durationSeconds / 30)) * 50, 50);

  return Math.max(0, Math.min(100, 50 + normalizedPositive - normalizedNegative));
}

function calculateLowHesitationScore(
  signals: InterhumanAnalysisResponse["signals"],
  durationSeconds: number
): number {
  const hesitationCount = countSignals(signals, "hesitation");
  const stressCount = countSignals(signals, "stress");
  const uncertaintyCount = countSignals(signals, "uncertainty");

  const totalNegative = hesitationCount + stressCount + uncertaintyCount;
  const expectedMax = durationSeconds / 20;

  if (totalNegative === 0) return 100;
  if (totalNegative >= expectedMax) return 30;

  return Math.round(100 - (totalNegative / expectedMax) * 70);
}

export function calculatePitchScore(
  analysis: InterhumanAnalysisResponse,
  durationSeconds: number
): Omit<PitchScore, "percentile"> {
  const { conversation_quality, signals } = analysis;
  
  const safeSignals = signals || [];
  
  // Check if we have conversation_quality from API
  const hasConversationQuality = !!conversation_quality?.overall;
  
  // Get scores from conversation_quality, or null if not available
  const authority = conversation_quality?.overall?.authority ?? null;
  const clarity = conversation_quality?.overall?.clarity ?? null;
  const energy = conversation_quality?.overall?.energy ?? null;

  // Signal-based scores (always calculated)
  const confidenceScore = calculateConfidenceScore(safeSignals, durationSeconds);
  const lowHesitationScore = calculateLowHesitationScore(safeSignals, durationSeconds);

  const breakdown = {
    authority: authority ?? 0,
    clarity: clarity ?? 0,
    energy: energy ?? 0,
    confidence: confidenceScore,
    lowHesitation: lowHesitationScore,
  };

  // Only calculate composite if we have conversation quality data
  let composite: number;
  if (hasConversationQuality) {
    composite = Math.round(
      breakdown.authority * 0.3 +
      breakdown.clarity * 0.25 +
      breakdown.energy * 0.2 +
      breakdown.confidence * 0.15 +
      breakdown.lowHesitation * 0.1
    );
  } else {
    // Use signal-based composite when no conversation quality
    composite = Math.round(
      (confidenceScore + lowHesitationScore) / 2
    );
  }

  const badges = calculateBadges(breakdown, composite, hasConversationQuality);

  return {
    composite,
    breakdown,
    badges,
    hasConversationQuality,
  } as Omit<PitchScore, "percentile">;
}

function calculateBadges(
  breakdown: PitchScore["breakdown"],
  composite: number,
  hasConversationQuality: boolean
): Badge[] {
  const earned: Badge[] = [];

  // Only award quality-based badges if we have conversation quality data
  if (hasConversationQuality) {
    if (breakdown.authority >= 85) {
      earned.push(BADGES.find((b) => b.id === "top_10_confidence")!);
    }

    if (breakdown.clarity >= 85) {
      earned.push(BADGES.find((b) => b.id === "crystal_clear")!);
    }

    if (breakdown.energy >= 85) {
      earned.push(BADGES.find((b) => b.id === "high_energy")!);
    }

    if (composite >= 80) {
      earned.push(BADGES.find((b) => b.id === "pitch_perfect")!);
    }
  }

  return earned.filter(Boolean);
}
