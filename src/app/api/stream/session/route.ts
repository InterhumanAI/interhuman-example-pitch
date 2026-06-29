import "server-only";

import { NextResponse } from "next/server";

import { mintStreamSession } from "@/lib/interhuman/stream-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Mint a short-lived signed session for the browser to open a WebSocket
 * directly to the Interhuman stream-proxy. The API key never reaches the
 * browser — only this signed, ~180s token does. See stream-token.ts for the
 * token format and the http(s)→ws(s) scheme rewrite.
 */
export async function POST() {
  try {
    const session = mintStreamSession();
    return NextResponse.json(session);
  } catch (err) {
    console.error("[/api/stream/session] mint failed", err);
    const message = err instanceof Error ? err.message : "Failed to mint session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
