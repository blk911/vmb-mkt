import { NextResponse } from "next/server";
import { parseHashtagPasteRequest } from "@/lib/hashtag-paste-intake/parser";
import { buildProviderCandidates } from "@/lib/hashtag-paste-intake/provider-candidates";
import type { HashtagPasteIntakeRequest, HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export const runtime = "nodejs";

function isRequestBody(value: unknown): value is HashtagPasteIntakeRequest {
  return Boolean(value)
    && typeof value === "object"
    && (value as HashtagPasteIntakeRequest).platform === "instagram"
    && typeof (value as HashtagPasteIntakeRequest).rawText === "string";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (!isRequestBody(body)) {
    return NextResponse.json({ ok: false as const, error: "invalid_request" }, { status: 400 });
  }
  if (!body.rawText.trim()) {
    return NextResponse.json({ ok: false as const, error: "rawText_required" }, { status: 400 });
  }

  try {
    const request: HashtagPasteIntakeRequest = {
      platform: "instagram",
      hashtag: body.hashtag?.trim() || undefined,
      geoHint: body.geoHint?.trim() || undefined,
      serviceHint: body.serviceHint?.trim() || undefined,
      rawText: body.rawText,
    };

    const { parsedPosts, diagnostics: parserDiagnostics } = parseHashtagPasteRequest(request);
    const providerCandidates = buildProviderCandidates(parsedPosts, request);

    const taggedHandleCounts = new Map<string, number>();
    for (const post of parsedPosts) {
      for (const handle of post.taggedHandles) {
        taggedHandleCounts.set(handle, (taggedHandleCounts.get(handle) || 0) + 1);
      }
    }

    const diagnostics = [...parserDiagnostics];
    if (!providerCandidates.length) diagnostics.push("no provider candidates identified");

    const result: HashtagPasteIntakeResult = {
      request,
      parsedPosts,
      providerCandidates,
      taggedHandles: [...taggedHandleCounts.entries()]
        .map(([handle, count]) => ({ handle, count }))
        .sort((a, b) => b.count - a.count || a.handle.localeCompare(b.handle)),
      clientSignalPosts: parsedPosts.filter((post) => post.inferredType === "client"),
      diagnostics,
    };

    return NextResponse.json({ ok: true as const, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "parse_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
