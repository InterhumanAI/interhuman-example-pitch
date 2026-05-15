import { NextResponse } from "next/server";
import { getInterhumanApiKey, InterhumanAPIError } from "@/lib/interhuman";

/** Provides upload authorization for browser-direct Interhuman uploads. */
export async function POST() {
  try {
    const access_token = getInterhumanApiKey();
    return NextResponse.json({ access_token });
  } catch (error) {
    if (error instanceof InterhumanAPIError) {
      return NextResponse.json(
        { error: error.message, errorCode: error.errorCode },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to authorize video upload" },
      { status: 500 }
    );
  }
}
