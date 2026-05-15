import { InterhumanAnalysisResponse } from "@/types";
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from "@/lib/upload-limits";

const INTERHUMAN_API_URL = "https://api.interhuman.ai";

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

function getInterhumanApiKey(): string {
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

/** Upload and analyze video on the server (after client-side compression). */
export async function analyzeVideo(
  videoFile: File | Blob
): Promise<InterhumanAnalysisResponse> {
  if (videoFile.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
    throw new InterhumanAPIError(
      `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`,
      413,
      undefined,
      "ih4003"
    );
  }

  const formData = new FormData();
  formData.append("file", videoFile, "video.mp4");
  formData.append("include[]", "conversation_quality_overall");

  const response = await fetch(`${INTERHUMAN_API_URL}/v1/upload/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getInterhumanApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Video analysis failed: ${errorText}`;
    let errorCode: string | undefined;

    try {
      const errorJson = JSON.parse(errorText);
      errorCode = errorJson.error_id;

      if (errorCode === "ih4003") {
        errorMessage = `Video file is too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // Use raw error text if not JSON
    }

    throw new InterhumanAPIError(
      errorMessage,
      response.status,
      errorText,
      errorCode
    );
  }

  return response.json();
}
