import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Create clients only if URL is provided
let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

// Helper to get supabase client with error handling
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return supabaseAdmin;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceKey);
}

// Export for backward compatibility (but may be null)
export { supabase, supabaseAdmin };

export type Pitch = {
  id: string;
  visitorId: string;
  durationSeconds: number;
  mode: "free_pitch" | "one_minute_challenge" | "qa_practice";
  createdAt: Date;
};

export type PitchAnalysis = {
  id: string;
  pitchId: string;
  qualityIndex: number;
  clarity: number;
  authority: number;
  energy: number;
  rapport: number;
  learning: number;
  engagementStatesJson: unknown;
  signalsJson: unknown;
  timelineJson: unknown;
  createdAt: Date;
};

export type PitchScore = {
  id: string;
  pitchId: string;
  visitorId: string;
  userName: string | null;
  mode: "free_pitch" | "one_minute_challenge" | "qa_practice" | null;
  compositeScore: number;
  percentileRank: number | null;
  authorityScore: number;
  clarityScore: number;
  energyScore: number;
  confidenceScore: number;
  hesitationScore: number;
  badgesEarned: string[];
  createdAt: Date;
};
