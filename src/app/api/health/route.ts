import "server-only";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    hasInterhumanKey: !!process.env.INTERHUMAN_API_KEY,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    interhumanStreamUrl: process.env.INTERHUMAN_STREAM_URL ? "set" : "default",
    hasStreamProxy:
      !!process.env.STREAM_PROXY_WS_URL &&
      !!process.env.DEMO_STREAM_PROXY_TOKEN_SECRET,
  });
}
