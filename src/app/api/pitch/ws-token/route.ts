import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.INTERHUMAN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "INTERHUMAN_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  return NextResponse.json({ token: apiKey });
}
