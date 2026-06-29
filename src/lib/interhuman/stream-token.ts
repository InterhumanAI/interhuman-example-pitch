import "server-only";

import { createHmac, randomUUID } from "node:crypto";

// The stream-proxy demo token rides on the first `sec-websocket-protocol`
// value (browsers can't set Authorization on a WebSocket). Format per the
// integration spec:
//   token = base64url(payloadJson) + "." + base64url(HMAC_SHA256(base64url(payloadJson), secret))
// The HMAC is computed over the *base64url-encoded payload string* (not the
// raw JSON), and the signature itself is base64url-encoded. The proxy verifies
// with a timing-safe comparison; a secret mismatch shows up only as a 401 on
// the WS upgrade, so the secret here MUST match the proxy's
// DEMO_STREAM_PROXY_TOKEN_SECRET exactly.

// Demo tokens are short-lived — mint immediately before connecting.
const TOKEN_TTL_SECONDS = 180;

export interface StreamTokenPayload {
  sessionId: string;
  visitorId: string;
  exp: number;
}

export interface MintedStreamSession {
  sessionId: string;
  wsUrl: string;
  token: string;
  expiresAt: string;
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function signStreamToken(payload: StreamTokenPayload, secret: string): string {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

/**
 * The deployed STREAM_PROXY_WS_URL is an http(s) URL, but a browser WebSocket
 * needs a ws(s):// scheme. Rewrite http→ws / https→wss (the same rewrite the
 * proxy applies to its own upstream base). The env value is fixed as-deployed,
 * so we never mutate it — only the value we hand to the browser.
 */
function toWebSocketUrl(raw: string): string {
  return raw.replace(/^http(s?):\/\//i, "ws$1://");
}

/**
 * Mint a signed stream-proxy session. Throws if the proxy env isn't configured
 * so the route can return a clear 500.
 */
export function mintStreamSession(): MintedStreamSession {
  const rawUrl = process.env.STREAM_PROXY_WS_URL?.trim();
  const secret = process.env.DEMO_STREAM_PROXY_TOKEN_SECRET?.trim();
  if (!rawUrl) {
    throw new Error("STREAM_PROXY_WS_URL is not set");
  }
  if (!secret || secret.length < 16) {
    throw new Error("DEMO_STREAM_PROXY_TOKEN_SECRET is not set (min 16 chars)");
  }

  const sessionId = randomUUID();
  // A stable-enough per-session visitor id; the proxy only requires ≥8 chars.
  const visitorId = `pitch_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  const payload: StreamTokenPayload = { sessionId, visitorId, exp };
  const token = signStreamToken(payload, secret);

  return {
    sessionId,
    wsUrl: toWebSocketUrl(rawUrl),
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
