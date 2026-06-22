import "server-only";

import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { analyzeBlobOverWs } from "@/lib/interhuman/analyze-blob";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import { parseLocalBlobId, readLocalBlob } from "@/lib/uploads/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BLOB_BYTES = 64 * 1024 * 1024;

interface AnalyzePayload {
  blobUrl?: string;
  videoPathname?: string | null;
  duration?: number;
  mode?: string;
  userName?: string | null;
  questionId?: string | null;
  include?: string[];
}

export async function POST(request: Request) {
  const apiKey = process.env.INTERHUMAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "INTERHUMAN_API_KEY is not set" },
      { status: 500 },
    );
  }

  let payload: AnalyzePayload;
  try {
    payload = (await request.json()) as AnalyzePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const blobUrl = payload.blobUrl;
  if (!blobUrl || !/^https?:\/\//.test(blobUrl)) {
    return NextResponse.json({ error: "blobUrl required" }, { status: 400 });
  }

  const localBlobId = parseLocalBlobId(blobUrl);
  if (!localBlobId && !isVercelBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "blobUrl must be a Vercel Blob URL" }, { status: 400 });
  }

  const duration = Number(payload.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "duration required" }, { status: 400 });
  }

  const mode = payload.mode || "free_pitch";

  let bytes: Uint8Array;
  try {
    if (localBlobId) {
      const local = await readLocalBlob(localBlobId);
      if (!local) {
        return NextResponse.json({ error: "Local blob not found" }, { status: 404 });
      }
      if (local.bytes.byteLength > MAX_BLOB_BYTES) {
        return NextResponse.json({ error: "Blob too large" }, { status: 413 });
      }
      bytes = new Uint8Array(local.bytes);
    } else {
      // Private blobs aren't reachable over plain HTTP — the SDK adds the
      // store's auth token automatically when invoked with our project's
      // BLOB_READ_WRITE_TOKEN.
      const result = await get(blobUrl, { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return NextResponse.json(
          { error: `Failed to fetch blob: ${result?.statusCode ?? "unknown"}` },
          { status: 502 },
        );
      }
      if (result.blob.size > MAX_BLOB_BYTES) {
        return NextResponse.json({ error: "Blob too large" }, { status: 413 });
      }
      const reader = result.stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_BLOB_BYTES) {
          try {
            await reader.cancel();
          } catch {
            /* noop */
          }
          return NextResponse.json({ error: "Blob too large" }, { status: 413 });
        }
        chunks.push(value);
      }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.byteLength;
      }
    }
  } catch (err) {
    console.error("[/api/pitch/analyze] fetch blob failed", err);
    return NextResponse.json({ error: "Failed to fetch blob" }, { status: 502 });
  }

  try {
    const analysis = await analyzeBlobOverWs({
      bytes,
      apiKey,
      config: {
        include: payload.include ?? [
          "conversation_quality_overall",
          "conversation_quality_timeline",
        ],
      },
    });

    const result = await completePitchAnalysis({
      analysis,
      duration,
      mode,
      userName: payload.userName ?? null,
      questionId: payload.questionId ?? null,
      videoUrl: blobUrl,
      videoPathname: payload.videoPathname ?? null,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/pitch/analyze] failed", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /(^|\.)(public\.)?blob\.vercel-storage\.com$/.test(parsed.hostname);
  } catch {
    return false;
  }
}
