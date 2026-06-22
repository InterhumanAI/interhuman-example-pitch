import "server-only";

import { NextResponse } from "next/server";

import { isAllowedPathname, issueUploadToken } from "@/lib/upload-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  if (!process.env.INTERHUMAN_API_KEY) {
    return NextResponse.json(
      { error: "INTERHUMAN_API_KEY is not set" },
      { status: 500 },
    );
  }

  let pathname: string | undefined;
  try {
    const body = (await request.json()) as { pathname?: string };
    pathname = body?.pathname;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!pathname || !isAllowedPathname(pathname)) {
    return NextResponse.json(
      { error: "pathname must match pitches/<id>.(webm|mp4)" },
      { status: 400 },
    );
  }

  const token = issueUploadToken(pathname);
  return NextResponse.json(token);
}
