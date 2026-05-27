/**
 * Server-side Interhuman utilities.
 *
 * The primary integration now uses WebSocket streaming directly from the
 * browser (see src/lib/interhuman-stream.ts). This module is kept for
 * reference and potential server-side fallback use.
 */

export class InterhumanAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
    public errorCode?: string
  ) {
    super(message);
    this.name = "InterhumanAPIError";
  }
}

export function getInterhumanApiKey(): string {
  const apiKey = process.env.INTERHUMAN_API_KEY;
  if (!apiKey) {
    throw new InterhumanAPIError(
      "INTERHUMAN_API_KEY must be configured",
      500,
      undefined,
      "MISSING_API_KEY"
    );
  }
  return apiKey;
}
