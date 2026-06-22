"use client";

export interface BlobUploadResult {
  url: string;
  pathname: string;
}

/**
 * Upload directly from the browser to Vercel Blob using a server-issued client
 * token. Parts stream straight to blob storage, so they never hit the ~4.5 MB
 * serverless request-body limit (and Vercel Blob's >=5 MB part minimum, which
 * makes proxying multipart through a function impossible).
 *
 * The @vercel/blob/client import is done dynamically so its transitive undici
 * dependency never lands in the statically-parsed client bundle (undici uses
 * syntax webpack's client loader can't parse). It loads only in the browser at
 * upload time.
 *
 * Throws if blob storage isn't configured (e.g. local dev) — callers should
 * fall back to the through-function multipart upload in that case.
 */
export async function uploadToBlob(args: {
  blob: Blob;
  pathname: string;
  contentType: string;
}): Promise<BlobUploadResult> {
  const { upload } = await import("@vercel/blob/client");
  const result = await upload(args.pathname, args.blob, {
    access: "private",
    handleUploadUrl: "/api/upload/blob",
    contentType: args.contentType,
    multipart: true,
  });
  return { url: result.url, pathname: result.pathname };
}
