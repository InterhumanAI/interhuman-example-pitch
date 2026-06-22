import "server-only";

import { NextResponse } from "next/server";

import { localUploadsEnabled, readLocalBlob } from "@/lib/uploads/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!localUploadsEnabled()) {
    return NextResponse.json({ error: "Not available in this environment" }, { status: 404 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(params.id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const blob = await readLocalBlob(params.id);
  if (!blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(blob.bytes), {
    status: 200,
    headers: {
      "content-type": blob.contentType,
      "content-length": String(blob.bytes.byteLength),
      "cache-control": "no-store",
    },
  });
}
