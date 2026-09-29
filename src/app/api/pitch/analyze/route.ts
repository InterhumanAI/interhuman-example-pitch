import "server-only";

import { del, get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { analyzeBlobOverWs } from "@/lib/interhuman/analyze-blob";
import { completePitchAnalysis } from "@/lib/complete-pitch-analysis";
import { analyzeContentFromAudio } from "@/lib/transcribe-pitch";
import { deleteLocalBlob, parseLocalBlobId, readLocalBlob } from "@/lib/uploads/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BLOB_BYTES = 64 * 1024 * 1024;
// OpenAI transcription caps uploads at 25 MB. The separate audio blob is far
// smaller, but enforce the limit defensively.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

interface AnalyzePayload {
  blobUrl?: string;
  videoPathname?: string | null;
  audioBlobUrl?: string;
  audioPathname?: string | null;
  duration?: number;
  mode?: string;
  userName?: string | null;
  questionId?: string | null;
  include?: string[];
  /** Byte size of each ~3s WebM segment from the browser, in order. */
  segmentSizes?: number[] | null;
  /** Consent record captured client-side before recording started — see src/lib/consent.ts. */
  consent?: { version: number; acceptedAt: string } | null;
}

class BlobFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Fetch a blob's bytes, supporting both the local-disk fallback store and
 * private Vercel Blob URLs. Throws BlobFetchError with an HTTP status on
 * failure or when the blob exceeds maxBytes.
 */
async function fetchBlobBytes(url: string, maxBytes: number): Promise<Uint8Array> {
  const localBlobId = parseLocalBlobId(url);
  if (localBlobId) {
    const local = await readLocalBlob(localBlobId);
    if (!local) {
      throw new BlobFetchError("Local blob not found", 404);
    }
    if (local.bytes.byteLength > maxBytes) {
      throw new BlobFetchError("Blob too large", 413);
    }
    return new Uint8Array(local.bytes);
  }

  // Private blobs aren't reachable over plain HTTP — the SDK adds the store's
  // auth token automatically when invoked with our BLOB_READ_WRITE_TOKEN.
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new BlobFetchError(
      `Failed to fetch blob: ${result?.statusCode ?? "unknown"}`,
      502,
    );
  }
  if (result.blob.size > maxBytes) {
    throw new BlobFetchError("Blob too large", 413);
  }
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* noop */
      }
      throw new BlobFetchError("Blob too large", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return bytes;
}

/**
 * Best-effort delete of an uploaded blob (video or audio) once we're done
 * with it, regardless of whether analysis succeeded or failed. We never
 * retain the recording server-side beyond the analysis request itself — see
 * the Privacy Policy. A delete failure must never surface to the client or
 * block the response; it's logged and swallowed.
 */
async function deleteBlobBestEffort(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const localBlobId = parseLocalBlobId(url);
    if (localBlobId) {
      await deleteLocalBlob(localBlobId);
      return;
    }
    await del(url);
  } catch (err) {
    console.warn("[/api/pitch/analyze] failed to delete blob after analysis", err);
  }
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
  const audioBlobUrl =
    payload.audioBlobUrl && /^https?:\/\//.test(payload.audioBlobUrl)
      ? payload.audioBlobUrl
      : null;

  try {
    let bytes: Uint8Array;
    try {
      bytes = await fetchBlobBytes(blobUrl, MAX_BLOB_BYTES);
    } catch (err) {
      if (err instanceof BlobFetchError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error("[/api/pitch/analyze] fetch blob failed", err);
      return NextResponse.json({ error: "Failed to fetch blob" }, { status: 502 });
    }

    // Fetch the optional separate audio blob for content scoring. A failure here
    // must not break the delivery path — fall back to delivery-only.
    let audioBytes: Uint8Array | null = null;
    if (audioBlobUrl) {
      try {
        audioBytes = await fetchBlobBytes(audioBlobUrl, MAX_AUDIO_BYTES);
      } catch (err) {
        console.warn("[/api/pitch/analyze] audio blob fetch failed, skipping content score", err);
      }
    }

    try {
      // Run delivery (Interhuman) and content (OpenAI) analysis concurrently so
      // content scoring adds minimal wall-clock. analyzeContentFromAudio never
      // throws — it returns null on any failure or when OpenAI isn't configured.
      const [analysis, content] = await Promise.all([
        analyzeBlobOverWs({
          bytes,
          apiKey,
          durationSeconds: duration,
          segmentSizes: Array.isArray(payload.segmentSizes)
            ? payload.segmentSizes
            : undefined,
          config: {
            include: payload.include ?? [
              "conversation_quality_overall",
              "conversation_quality_timeline",
            ],
          },
        }),
        audioBytes
          ? analyzeContentFromAudio({
              audioBytes,
              audioContentType: "audio/webm",
              durationSeconds: duration,
              mode,
            })
          : Promise.resolve(null),
      ]);

      const result = await completePitchAnalysis({
        analysis,
        duration,
        mode,
        userName: payload.userName ?? null,
        questionId: payload.questionId ?? null,
        // We never persist a pointer to the recording — both blobs are
        // deleted in the `finally` below right after this request finishes,
        // so a stored URL would immediately be dead and misleading.
        consent: payload.consent ?? null,
        content,
      });

      return NextResponse.json(result);
    } catch (err) {
      console.error("[/api/pitch/analyze] failed", err);
      const message = err instanceof Error ? err.message : "Analysis failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } finally {
    // Delete the uploaded video/audio now that we're done with them, whether
    // analysis succeeded or failed. This is what makes it true that we don't
    // retain the recording server-side after analysis — see Privacy Policy.
    await Promise.all([
      deleteBlobBestEffort(blobUrl),
      deleteBlobBestEffort(audioBlobUrl),
    ]);
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
