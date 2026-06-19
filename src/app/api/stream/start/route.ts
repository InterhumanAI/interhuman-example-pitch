import "server-only";

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createStreamSession } from "@/lib/interhuman/stream-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const apiKey = process.env.INTERHUMAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "INTERHUMAN_API_KEY is not set" },
      { status: 500 },
    );
  }

  let config: Record<string, unknown> | undefined;
  try {
    const body = (await request.json().catch(() => null)) as
      | { include?: string[]; config?: Record<string, unknown> }
      | null;
    if (body?.config) {
      config = body.config;
    } else if (body?.include) {
      config = { include: body.include };
    }
  } catch {
    /* body is optional */
  }

  if (!config) {
    config = {
      include: ["conversation_quality_overall", "conversation_quality_timeline"],
    };
  }

  const submissionId = nanoid();
  const token = nanoid(32);

  try {
    const session = await createStreamSession({
      submissionId,
      token,
      apiKey,
      config,
    });
    return NextResponse.json({
      sessionId: session.id,
      token,
      submissionId,
    });
  } catch (err) {
    console.error("[/api/stream/start] failed", err);
    const message = err instanceof Error ? err.message : "Failed to open stream";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
