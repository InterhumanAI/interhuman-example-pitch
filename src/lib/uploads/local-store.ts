import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), ".next-uploads");

export function localUploadsEnabled(): boolean {
  return !process.env.BLOB_READ_WRITE_TOKEN;
}

function uploadDir(uploadId: string): string {
  return join(ROOT, "parts", uploadId);
}

function blobPath(blobId: string): string {
  return join(ROOT, "blobs", `${blobId}.bin`);
}

function blobMetaPath(blobId: string): string {
  return join(ROOT, "blobs", `${blobId}.json`);
}

export async function localCreateMultipart(): Promise<{ uploadId: string; key: string }> {
  const uploadId = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await mkdir(uploadDir(uploadId), { recursive: true });
  return { uploadId, key: uploadId };
}

export async function localUploadPart(
  uploadId: string,
  partNumber: number,
  body: ArrayBuffer,
): Promise<{ etag: string; partNumber: number }> {
  const dir = uploadDir(uploadId);
  if (!existsSync(dir)) {
    throw new Error("Unknown uploadId");
  }
  const partFile = join(dir, `${partNumber.toString().padStart(6, "0")}.part`);
  await writeFile(partFile, Buffer.from(body));
  return { etag: `etag_${uploadId}_${partNumber}`, partNumber };
}

export async function localCompleteMultipart(
  uploadId: string,
  pathname: string,
  parts: { partNumber: number; etag: string }[],
  contentType: string,
  baseUrl: string,
): Promise<{ url: string; pathname: string; downloadUrl: string }> {
  const dir = uploadDir(uploadId);
  if (!existsSync(dir)) {
    throw new Error("Unknown uploadId");
  }
  const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const buffers: Buffer[] = [];
  for (const p of ordered) {
    const partFile = join(dir, `${p.partNumber.toString().padStart(6, "0")}.part`);
    buffers.push(await readFile(partFile));
  }
  const combined = Buffer.concat(buffers);

  const blobId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await mkdir(join(ROOT, "blobs"), { recursive: true });
  await writeFile(blobPath(blobId), combined);
  await writeFile(
    blobMetaPath(blobId),
    JSON.stringify({ pathname, contentType, size: combined.byteLength }),
  );
  await rm(dir, { recursive: true, force: true });

  const url = `${baseUrl}/api/blob/${blobId}`;
  return { url, pathname, downloadUrl: url };
}

export interface LocalBlob {
  bytes: Buffer;
  contentType: string;
}

export async function readLocalBlob(blobId: string): Promise<LocalBlob | null> {
  const path = blobPath(blobId);
  if (!existsSync(path)) return null;
  const bytes = await readFile(path);
  let contentType = "video/webm";
  try {
    const meta = JSON.parse(await readFile(blobMetaPath(blobId), "utf8")) as {
      contentType?: string;
    };
    if (meta.contentType) contentType = meta.contentType;
  } catch {
    /* fall through with default */
  }
  return { bytes, contentType };
}

export function parseLocalBlobId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^\/api\/blob\/([A-Za-z0-9_-]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
