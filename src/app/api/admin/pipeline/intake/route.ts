import { NextResponse } from "next/server";
import { submitUnifiedIntake } from "@/lib/admin/intake-adapter";
import type { BuildSourceType } from "@/lib/admin/pipeline/types";

export const runtime = "nodejs";

type IntakeBody = {
  sourceType?: BuildSourceType;
  rawText?: string;
};

function isBuildSourceType(value: unknown): value is BuildSourceType {
  return value === "Instagram" || value === "DORA" || value === "Upload" || value === "URL";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntakeBody;
    if (!isBuildSourceType(body.sourceType)) {
      return NextResponse.json({ ok: false as const, error: "invalid_sourceType" }, { status: 400 });
    }
    if (typeof body.rawText !== "string" || !body.rawText.trim()) {
      return NextResponse.json({ ok: false as const, error: "rawText_required" }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const result = await submitUnifiedIntake({
      sourceType: body.sourceType,
      rawText: body.rawText,
      origin,
      cookieHeader: req.headers.get("cookie") || undefined,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
