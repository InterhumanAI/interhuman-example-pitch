-- The Pitch Practice Database Schema (Simplified)
-- Run this in Supabase SQL Editor to create all tables

-- CreateEnum
CREATE TYPE "PitchMode" AS ENUM ('free_pitch', 'one_minute_challenge', 'qa_practice');

-- CreateTable: Pitch
-- Stores metadata about each pitch recording
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "mode" "PitchMode" NOT NULL,
    "videoUrl" TEXT,
    "videoPathname" TEXT,
    "consentVersion" INTEGER,
    "consentAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);
-- visitorId is an anonymous identifier (anon_xxx).
-- videoUrl / videoPathname are LEGACY and unused going forward: the app used
-- to point these at the Vercel Blob copy of the recording, but that copy is
-- now deleted immediately after analysis (see /api/pitch/analyze), so a
-- populated URL would be a dead link. New rows never set these columns. The
-- browser separately keeps its own copy in IndexedDB for local playback.
-- Existing deployments may run `UPDATE "Pitch" SET "videoUrl" = NULL,
-- "videoPathname" = NULL;` to clear stale pointers, or drop the columns
-- entirely once no code depends on them.
-- consentVersion / consentAcceptedAt are a server-side audit trail of the
-- consent shown in <ConsentGate> at recording time (see src/lib/consent.ts) —
-- which disclosure version the user agreed to, and when. This lets us
-- demonstrate consent was given (GDPR Art. 7(1)) rather than relying solely
-- on the client-side localStorage record, which the user controls and could
-- be cleared or forged.

-- Migration for existing deployments:
-- ALTER TABLE "Pitch" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
-- ALTER TABLE "Pitch" ADD COLUMN IF NOT EXISTS "videoPathname" TEXT;
-- ALTER TABLE "Pitch" ADD COLUMN IF NOT EXISTS "consentVersion" INTEGER;
-- ALTER TABLE "Pitch" ADD COLUMN IF NOT EXISTS "consentAcceptedAt" TIMESTAMP(3);

-- CreateTable: PitchAnalysis
-- Stores the Interhuman AI analysis results
CREATE TABLE "PitchAnalysis" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "qualityIndex" INTEGER NOT NULL,
    "clarity" INTEGER NOT NULL,
    "authority" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "rapport" INTEGER NOT NULL,
    "learning" INTEGER NOT NULL,
    "engagementStatesJson" JSONB NOT NULL,
    "signalsJson" JSONB NOT NULL,
    "timelineJson" JSONB NOT NULL,
    "transcriptText" TEXT,
    "contentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PitchAnalysis_pkey" PRIMARY KEY ("id")
);
-- transcriptText / contentJson hold the OpenAI transcript + content score.
-- Migration for existing deployments:
-- ALTER TABLE "PitchAnalysis" ADD COLUMN IF NOT EXISTS "transcriptText" TEXT;
-- ALTER TABLE "PitchAnalysis" ADD COLUMN IF NOT EXISTS "contentJson" JSONB;
CREATE UNIQUE INDEX "PitchAnalysis_pitchId_key" ON "PitchAnalysis"("pitchId");
ALTER TABLE "PitchAnalysis" ADD CONSTRAINT "PitchAnalysis_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PitchScore
-- Stores computed scores for the leaderboard
CREATE TABLE "PitchScore" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userName" TEXT DEFAULT 'Anonymous Founder',
    "mode" "PitchMode",
    "compositeScore" INTEGER NOT NULL,
    "deliveryScore" INTEGER,
    "contentScore" INTEGER,
    "hasContentScore" BOOLEAN DEFAULT false,
    "percentileRank" DOUBLE PRECISION,
    "authorityScore" INTEGER NOT NULL,
    "clarityScore" INTEGER NOT NULL,
    "energyScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "hesitationScore" INTEGER NOT NULL,
    "badgesEarned" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PitchScore_pkey" PRIMARY KEY ("id")
);
-- compositeScore is the blended overall score (delivery + content).
-- deliveryScore retains the delivery-only number; contentScore is null when
-- transcript scoring was unavailable.
-- Migration for existing deployments:
-- ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "deliveryScore" INTEGER;
-- ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "contentScore" INTEGER;
-- ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "hasContentScore" BOOLEAN DEFAULT false;
CREATE UNIQUE INDEX "PitchScore_pitchId_key" ON "PitchScore"("pitchId");
CREATE INDEX "PitchScore_visitorId_compositeScore_idx" ON "PitchScore"("visitorId", "compositeScore");
CREATE INDEX "PitchScore_createdAt_idx" ON "PitchScore"("createdAt");
CREATE INDEX "PitchScore_mode_compositeScore_idx" ON "PitchScore"("mode", "compositeScore" DESC);
ALTER TABLE "PitchScore" ADD CONSTRAINT "PitchScore_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON TYPE "PitchMode" TO postgres, service_role;
