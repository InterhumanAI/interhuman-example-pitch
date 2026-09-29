"use client";

/**
 * GDPR consent gate for camera/mic recordings.
 *
 * Recording a pitch sends video/audio to Interhuman AI for behavioral
 * analysis (streamed live, or uploaded and deleted after analysis as a
 * fallback) and the resulting text transcript to OpenAI for content
 * scoring, and — always, for this deployment — data is used under
 * Interhuman's Model Improvement Program (MIP) to help train their models.
 * These are third-party processing purposes the user must be informed of and
 * explicitly agree to before we ever touch the camera/microphone.
 *
 * Consent is recorded client-side (no account system exists) and is re-asked
 * whenever CONSENT_VERSION changes, so updates to what we disclose here
 * invalidate any prior consent automatically. A copy of the version/timestamp
 * is also sent with each analysis request and persisted server-side (see
 * completePitchAnalysis) as an audit trail, since the client-side copy alone
 * can't demonstrate consent was given.
 */

const CONSENT_STORAGE_KEY = "thepitchpractice_consent";

/** Bump this whenever the disclosure text in <ConsentGate> materially changes. */
export const CONSENT_VERSION = 6;

export interface ConsentRecord {
  version: number;
  acceptedAt: string;
}

export function getStoredConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.version !== CONSENT_VERSION || !parsed.acceptedAt) return null;
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    return null;
  }
}

export function hasValidConsent(): boolean {
  return getStoredConsent() !== null;
}

/**
 * Consent info to attach to an analysis request so the server can persist an
 * audit trail (which disclosure version was shown, and when it was accepted)
 * alongside the Pitch row. Returns null if there's no valid consent, in which
 * case the caller shouldn't be submitting an analysis request at all.
 */
export function getConsentForSubmission(): { version: number; acceptedAt: string } | null {
  return getStoredConsent();
}

export function recordConsent(): void {
  if (typeof window === "undefined") return;
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (e.g. private browsing) — consent will simply
    // be asked again next time, which is the safe direction to fail in.
  }
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
