import { InterhumanAnalysisResponse } from "@/types";

const INTERHUMAN_API_URL = "https://api.interhuman.ai";
const INTERHUMAN_API_KEY = process.env.INTERHUMAN_API_KEY;
const MAX_FILE_SIZE_MB = 32;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

export async function analyzeVideo(
  videoFile: File | Blob
): Promise<InterhumanAnalysisResponse> {
  if (!INTERHUMAN_API_KEY) {
    throw new InterhumanAPIError("INTERHUMAN_API_KEY must be configured");
  }

  // Check file size before uploading
  if (videoFile.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
    throw new InterhumanAPIError(
      `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please record a shorter video.`,
      413,
      undefined,
      "ih4003"
    );
  }

  const formData = new FormData();
  formData.append("file", videoFile, "video.mp4");
  // Request conversation quality data (optional field per API docs)
  formData.append("include[]", "conversation_quality_overall");

  const response = await fetch(`${INTERHUMAN_API_URL}/v1/upload/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INTERHUMAN_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Video analysis failed: ${errorText}`;
    let errorCode: string | undefined;

    // Parse error response for better messages
    try {
      const errorJson = JSON.parse(errorText);
      errorCode = errorJson.error_id;

      if (errorCode === "ih4003") {
        errorMessage = `Video file is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Please record a shorter video.`;
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

export async function analyzeVideoFromUrl(
  videoUrl: string
): Promise<InterhumanAnalysisResponse> {
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new InterhumanAPIError(`Failed to fetch video from URL: ${videoUrl}`);
  }

  const videoBlob = await videoResponse.blob();
  return analyzeVideo(videoBlob);
}
