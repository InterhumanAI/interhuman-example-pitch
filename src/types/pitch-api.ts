import { InterhumanAnalysisResponse, PitchScore } from "@/types";

export type PitchAnalyzeApiResponse = {
  analysis: InterhumanAnalysisResponse;
  score: PitchScore;
  mode: string;
  duration: number;
  pitchId: string | null;
  scoreId: string | null;
  savedToLeaderboard?: boolean;
};
