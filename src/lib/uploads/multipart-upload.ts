const PART_SIZE_BYTES = 8 * 1024 * 1024;
const PART_CONCURRENCY = 3;
const PART_RETRIES = 4;
const PART_RETRY_BACKOFF_MS = [250, 500, 1000, 2000];

interface UploadInChunksParams {
  blob: Blob;
  pathname: string;
  streamSessionId: string;
  streamToken: string;
  contentType?: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
}

interface UploadResult {
  url: string;
  pathname: string;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

async function uploadOnePart(args: {
  url: string;
  body: Blob;
  headers: Record<string, string>;
}): Promise<{ etag: string; partNumber: number }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < PART_RETRIES; attempt++) {
    try {
      const res = await fetch(args.url, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          ...args.headers,
        },
        body: args.body,
      });
      if (!res.ok) throw new Error(`part upload -> ${res.status}`);
      return (await res.json()) as { etag: string; partNumber: number };
    } catch (err) {
      lastErr = err;
      if (attempt === PART_RETRIES - 1) break;
      await new Promise((r) => setTimeout(r, PART_RETRY_BACKOFF_MS[attempt]));
    }
  }
  throw lastErr ?? new Error("part upload failed");
}

export async function uploadInChunks({
  blob,
  pathname,
  streamSessionId,
  streamToken,
  contentType,
  onProgress,
}: UploadInChunksParams): Promise<UploadResult> {
  const ct = contentType ?? blob.type ?? "video/webm";
  const auth = {
    "x-stream-session-id": streamSessionId,
    "x-stream-token": streamToken,
  };

  const created = await postJson<{ uploadId: string; key: string }>(
    "/api/upload/multipart?action=create",
    { pathname, contentType: ct },
    auth,
  );

  const partCount = Math.max(1, Math.ceil(blob.size / PART_SIZE_BYTES));
  const partJobs = Array.from({ length: partCount }, (_, i) => i + 1);
  const partResults = new Array<{ partNumber: number; etag: string } | null>(
    partCount,
  ).fill(null);

  let cursor = 0;
  let uploadedBytes = 0;
  async function worker() {
    while (cursor < partJobs.length) {
      const my = cursor++;
      if (my >= partJobs.length) return;
      const partNumber = partJobs[my];
      const start = (partNumber - 1) * PART_SIZE_BYTES;
      const end = Math.min(blob.size, partNumber * PART_SIZE_BYTES);
      const slice = blob.slice(start, end, ct);
      const result = await uploadOnePart({
        url: "/api/upload/multipart?action=part",
        body: slice,
        headers: {
          ...auth,
          "x-upload-id": created.uploadId,
          "x-key": created.key,
          "x-part-number": String(partNumber),
          "x-pathname": pathname,
        },
      });
      partResults[partNumber - 1] = result;
      uploadedBytes += end - start;
      onProgress?.(uploadedBytes, blob.size);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, () => worker()),
  );

  const parts = partResults.filter(
    (p): p is { partNumber: number; etag: string } => p !== null,
  );
  if (parts.length !== partCount) {
    throw new Error("missing part results");
  }

  const completed = await postJson<{ url: string; pathname: string }>(
    "/api/upload/multipart?action=complete",
    {
      uploadId: created.uploadId,
      key: created.key,
      pathname,
      parts,
      contentType: ct,
    },
    auth,
  );

  return { url: completed.url, pathname: completed.pathname };
}
