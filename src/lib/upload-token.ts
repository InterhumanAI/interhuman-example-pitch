import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 10 * 60_000;
const ALLOWED_PATHNAME = /^(pitches|pitch-audio)\/[a-z0-9_-]+\.(webm|mp4|m4a)$/i;

function getSigningKey(): string {
  const key = process.env.INTERHUMAN_API_KEY;
  if (!key) {
    throw new Error("INTERHUMAN_API_KEY is not set");
  }
  return key;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export interface UploadToken {
  pathname: string;
  expires: number;
  signature: string;
}

export function isAllowedPathname(pathname: string): boolean {
  return ALLOWED_PATHNAME.test(pathname);
}

export function issueUploadToken(pathname: string): UploadToken {
  const expires = Date.now() + TOKEN_TTL_MS;
  const signature = sign(`${pathname}|${expires}`, getSigningKey());
  return { pathname, expires, signature };
}

export function verifyUploadToken(
  pathname: string | null | undefined,
  expiresRaw: string | null | undefined,
  signature: string | null | undefined,
): boolean {
  if (!pathname || !expiresRaw || !signature) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  if (!isAllowedPathname(pathname)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(sign(`${pathname}|${expires}`, getSigningKey()), "hex");
  } catch {
    return false;
  }
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
