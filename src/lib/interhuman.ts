import { InterhumanAnalysisResponse } from "@/types";

const INTERHUMAN_API_URL = "https://api.interhuman.ai";
const INTERHUMAN_KEY_ID = process.env.INTERHUMAN_KEY_ID;
const INTERHUMAN_KEY_SECRET = process.env.INTERHUMAN_KEY_SECRET;
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

async function getAccessToken(): Promise<string> {
  if (!INTERHUMAN_KEY_ID || !INTERHUMAN_KEY_SECRET) {
    throw new InterhumanAPIError(
      "INTERHUMAN_KEY_ID and INTERHUMAN_KEY_SECRET must be configured"
    );
  }

  const response = await fetch(`${INTERHUMAN_API_URL}/v1/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key_id: INTERHUMAN_KEY_ID,
      key_secret: INTERHUMAN_KEY_SECRET,
      scopes: ["interhumanai.upload"],
    }),
  });

  if (!response.ok) {
    throw new InterhumanAPIError(
      "Failed to get access token",
      response.status,
      await response.text()
    );
  }

  const data = await response.json();
  return data.access_token;
}

export async function analyzeVideo(
  videoFile: File | Blob
): Promise<InterhumanAnalysisResponse> {
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

  const accessToken = await getAccessToken();

  const formData = new FormData();
  formData.append("file", videoFile, "video.mp4");
  // Request conversation quality data (optional field per API docs)
  formData.append("include[]", "conversation_quality_overall");

  const response = await fetch(`${INTERHUMAN_API_URL}/v1/upload/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
