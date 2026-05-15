"use client";

import { InterhumanAnalysisResponse } from "@/types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

const INTERHUMAN_API_URL = "https://api.interhuman.ai";

/** Upload video directly from the browser to Interhuman. */
export async function analyzeVideoDirect(
  videoFile: Blob,
  accessToken: string
): Promise<InterhumanAnalysisResponse> {
  if (videoFile.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Video file is too large (${sizeMB}MB). Maximum size is ${MAX_UPLOAD_SIZE_MB}MB. Please record a shorter video.`
    );
  }

  const formData = new FormData();
  formData.append("file", videoFile, "video.mp4");
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
    let errorMessage = "Video analysis failed";

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error_id === "ih4003") {
        errorMessage = `Video file is too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB. Please record a shorter video.`;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText) errorMessage = errorText.slice(0, 200);
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
