import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

async function loadEnvFile() {
  try {
    const contents = await readFile(envPath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i === -1) continue;
      const key = trimmed.slice(0, i).trim();
      const value = trimmed.slice(i + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const poolerPrefixes = ["aws-1", "aws-0"];
const poolerRegions = [
  "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3",
  "eu-north-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ap-south-1", "sa-east-1", "ca-central-1",
];

function getProjectRef(supabaseUrl) {
  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/);
  if (!match) throw new Error("NEXT_PUBLIC_SUPABASE_URL malformed");
  return match[1];
}

function buildConnectionCandidates({ projectRef, password }) {
  const encodedPassword = encodeURIComponent(password);
  const poolerUser = `postgres.${projectRef}`;
  return poolerPrefixes.flatMap((prefix) =>
    poolerRegions.flatMap((region) =>
      [5432, 6543].map(
        (port) =>
          `postgresql://${poolerUser}:${encodedPassword}@${prefix}-${region}.pooler.supabase.com:${port}/postgres?sslmode=require`
      )
    )
  );
}

async function connect(candidates) {
  let lastError;
  for (const connectionString of candidates) {
    const sql = postgres(connectionString, { max: 1, connect_timeout: 10 });
    try {
      await sql`select 1 as ok`;
      return sql;
    } catch (error) {
      lastError = error;
      await sql.end({ timeout: 1 }).catch(() => undefined);
    }
  }
  throw lastError ?? new Error("Could not connect to Supabase Postgres");
}

const STATEMENTS = [
  `ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "deliveryScore" INTEGER`,
  `ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "contentScore" INTEGER`,
  `ALTER TABLE "PitchScore" ADD COLUMN IF NOT EXISTS "hasContentScore" BOOLEAN DEFAULT false`,
  `ALTER TABLE "PitchAnalysis" ADD COLUMN IF NOT EXISTS "transcriptText" TEXT`,
  `ALTER TABLE "PitchAnalysis" ADD COLUMN IF NOT EXISTS "contentJson" JSONB`,
];

async function main() {
  await loadEnvFile();
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!databaseUrl && (!supabaseUrl || !password)) {
    throw new Error(
      "Set SUPABASE_DB_URL or both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD."
    );
  }
  const sql = databaseUrl
    ? postgres(databaseUrl, { max: 1, connect_timeout: 10 })
    : await connect(
        buildConnectionCandidates({ projectRef: getProjectRef(supabaseUrl), password })
      );
  try {
    for (const stmt of STATEMENTS) {
      await sql.unsafe(stmt);
      console.log("OK:", stmt);
    }
    console.log("Content-scoring columns migrated.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
