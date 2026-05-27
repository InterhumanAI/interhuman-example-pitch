import { NextResponse } from "next/server";

/**
 * This route has been replaced by the WebSocket streaming architecture.
 * Video is now streamed directly from the browser to Interhuman's
 * wss://api.interhuman.ai/v1/stream/analyze endpoint, bypassing
 * Vercel's 4.5MB body size limit entirely.
 *
 * See:
 *   - /api/pitch/ws-token  (provides auth token to client)
 *   - /api/pitch/save-results (persists analysis to Supabase)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Video analysis now uses WebSocket streaming directly from the browser.",
      migration: "Use /api/pitch/ws-token + WebSocket streaming + /api/pitch/save-results",
    },
    { status: 410 }
  );
}
