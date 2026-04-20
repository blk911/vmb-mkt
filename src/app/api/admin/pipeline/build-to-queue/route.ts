import { NextResponse } from "next/server";
import { persistBuildSubmissionToValidationQueue } from "@/lib/admin/pipeline/build-queue";
import type { BuildSourceType } from "@/lib/admin/pipeline/types";

export const runtime = "nodejs";

type BuildQueueBody = {
  sourceType?: BuildSourceType;
  rawText?: string;
};

function isBuildSourceType(value: unknown): value is BuildSourceType {
  return value === "Instagram" || value === "DORA" || value === "Upload" || value === "URL";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BuildQueueBody;
    if (!isBuildSourceType(body.sourceType)) {
      return NextResponse.json({ ok: false as const, error: "invalid_sourceType" }, { status: 400 });
    }
    if (typeof body.rawText !== "string" || !body.rawText.trim()) {
      return NextResponse.json({ ok: false as const, error: "rawText_required" }, { status: 400 });
    }

    const summary = await persistBuildSubmissionToValidationQueue({
      sourceType: body.sourceType,
      rawText: body.rawText,
    });

    return NextResponse.json({ ok: true as const, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
