import "server-only";

import {
  completeMultipartUpload,
  createMultipartUpload,
  uploadPart,
} from "@vercel/blob";
import { NextResponse } from "next/server";

import { verifyUploadToken } from "@/lib/upload-token";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["video/webm", "video/mp4"]);
const MAX_PART_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_PARTS = 256;

function authorize(req: Request, pathname: string | null) {
  const token = req.headers.get("x-upload-token");
  const expires = req.headers.get("x-upload-expires");
  if (!pathname || !verifyUploadToken(pathname, expires, token)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Bad upload token" }, { status: 401 }),
    };
  }
  return { ok: true as const };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not set" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "create") {
      const { pathname, contentType } = (await request.json()) as {
        pathname?: string;
        contentType?: string;
      };
      const auth = authorize(request, pathname ?? null);
      if (!auth.ok) return auth.res;
      const baseType = (contentType ?? "video/webm").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.has(baseType)) {
        return NextResponse.json(
          { error: `Unsupported content-type: ${contentType}` },
          { status: 415 },
        );
      }
      const result = await createMultipartUpload(pathname!, {
        access: "public",
        contentType: baseType,
        addRandomSuffix: true,
      });
      return NextResponse.json({ uploadId: result.uploadId, key: result.key });
    }

    if (action === "part") {
      const pathname = request.headers.get("x-pathname");
      const auth = authorize(request, pathname);
      if (!auth.ok) return auth.res;

      const uploadId = request.headers.get("x-upload-id");
      const key = request.headers.get("x-key");
      const partNumberRaw = request.headers.get("x-part-number");
      if (!uploadId || !key || !partNumberRaw) {
        return NextResponse.json(
          { error: "Missing multipart headers" },
          { status: 400 },
        );
      }
      const partNumber = Number(partNumberRaw);
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_TOTAL_PARTS) {
        return NextResponse.json({ error: "Bad partNumber" }, { status: 400 });
      }
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (contentLength && contentLength > MAX_PART_BYTES) {
        return NextResponse.json({ error: "Part too large" }, { status: 413 });
      }
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_PART_BYTES) {
        return NextResponse.json({ error: "Part too large" }, { status: 413 });
      }
      const result = await uploadPart(pathname!, body, {
        access: "public",
        uploadId,
        key,
        partNumber,
      });
      return NextResponse.json({ etag: result.etag, partNumber: result.partNumber });
    }

    if (action === "complete") {
      const { uploadId, key, pathname, parts, contentType } = (await request.json()) as {
        uploadId?: string;
        key?: string;
        pathname?: string;
        contentType?: string;
        parts?: { partNumber: number; etag: string }[];
      };
      const auth = authorize(request, pathname ?? null);
      if (!auth.ok) return auth.res;
      if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
        return NextResponse.json(
          { error: "Missing complete payload" },
          { status: 400 },
        );
      }
      const baseType = (contentType ?? "video/webm").split(";")[0].trim().toLowerCase();
      const result = await completeMultipartUpload(pathname!, parts, {
        access: "public",
        uploadId,
        key,
        contentType: baseType,
      });
      return NextResponse.json({
        url: result.url,
        pathname: result.pathname,
        downloadUrl: result.downloadUrl,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[/api/upload/multipart] action=${action} failed`, err);
    const message = err instanceof Error ? err.message : "Multipart upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
