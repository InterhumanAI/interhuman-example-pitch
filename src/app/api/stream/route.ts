import "server-only";

import {
  getStreamSession,
  sendSegment,
  subscribe,
} from "@/lib/interhuman/stream-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SEGMENT_BYTES = 32 * 1024 * 1024;
const MIN_SEGMENT_BYTES = 1_024;

function authorize(req: Request, sessionId: string | null) {
  if (!sessionId) return { ok: false as const, status: 400, error: "Missing sessionId" };
  const session = getStreamSession(sessionId);
  if (!session) return { ok: false as const, status: 404, error: "Session not found" };
  const token =
    req.headers.get("x-stream-token") ??
    new URL(req.url).searchParams.get("token");
  if (!token || token !== session.token) {
    return { ok: false as const, status: 401, error: "Bad token" };
  }
  return { ok: true as const, session };
}

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-stream-session-id");
  const auth = authorize(req, sessionId);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (!contentLengthHeader || Number.isNaN(contentLength)) {
    return Response.json({ error: "Missing Content-Length" }, { status: 411 });
  }
  if (contentLength < MIN_SEGMENT_BYTES) {
    return Response.json({ error: "Segment too small" }, { status: 400 });
  }
  if (contentLength > MAX_SEGMENT_BYTES) {
    return Response.json({ error: "Segment too large (max 32MB)" }, { status: 413 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength < MIN_SEGMENT_BYTES) {
    return Response.json({ error: "Segment too small" }, { status: 400 });
  }
  if (body.byteLength > MAX_SEGMENT_BYTES) {
    return Response.json({ error: "Segment too large (max 32MB)" }, { status: 413 });
  }

  try {
    sendSegment(auth.session, body);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, bytes: body.byteLength });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const auth = authorize(req, sessionId);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { session } = auth;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const listener = (event: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        } catch {
          unsubscribe();
        }
      };
      const unsubscribe = subscribe(session, listener);

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "connection.established",
            correlation_id: session.correlationId,
            sessionId: session.id,
          })}\n\n`,
        ),
      );

      req.signal.addEventListener("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
