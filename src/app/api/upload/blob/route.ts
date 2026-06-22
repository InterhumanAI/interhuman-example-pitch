import "server-only";

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isAllowedPathname } from "@/lib/upload-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Client-direct uploads bypass the ~4.5 MB serverless request-body limit: the
// browser uploads parts straight to Vercel Blob using a short-lived client
// token issued here. Vercel Blob multipart also requires parts >= 5 MB, which
// is impossible to proxy through a function under the body cap — so this is the
// only viable path in production. Local dev (no BLOB_READ_WRITE_TOKEN) uses the
// through-function multipart route + local-disk store instead.
const ALLOWED_CONTENT_TYPES = [
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
];
const MAX_SIZE_BYTES = 64 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage not configured" },
      { status: 500 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedPathname(pathname)) {
          throw new Error("Pathname not allowed");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
      // The client receives the blob URL directly from upload()'s return value,
      // so no DB write is needed here. (Vercel can't reach localhost callbacks
      // anyway.)
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload token failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
