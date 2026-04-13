import { NextResponse } from "next/server";
import { fetchExternalSite } from "@/lib/external-site-capture/fetch";
import { parseGlossGeniusProfile } from "@/lib/external-site-capture/glossgenius-parser";
import { mapExtractedProfileToVmbProfile } from "@/lib/external-site-capture/map-to-vmb";
import type { ExternalSiteCaptureRequest, ExternalSourceType } from "@/lib/external-site-capture/types";

export const runtime = "nodejs";

function isExternalSourceType(value: unknown): value is ExternalSourceType {
  return value === "glossgenius" || value === "vagaro" || value === "square" || value === "other";
}

function isHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: ExternalSiteCaptureRequest;
  try {
    body = (await req.json()) as ExternalSiteCaptureRequest;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isHttpUrl(url)) {
    return NextResponse.json({ ok: false as const, error: "valid_url_required" }, { status: 400 });
  }
  if (!isExternalSourceType(body.sourceType)) {
    return NextResponse.json({ ok: false as const, error: "invalid_sourceType" }, { status: 400 });
  }

  try {
    const request: ExternalSiteCaptureRequest = { url, sourceType: body.sourceType };
    const raw = await fetchExternalSite(request);
    const extracted = parseGlossGeniusProfile(raw, request.sourceType);
    const mapped = mapExtractedProfileToVmbProfile(extracted);
    return NextResponse.json({ ok: true as const, request, raw, extracted, mapped });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "capture_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
