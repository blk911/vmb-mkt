import { NextResponse } from "next/server";
import { createSourceIntake, listSourceIntakes } from "@/lib/source-intake/store";
import { SOURCE_TYPES, type SourceIntakeCreateInput } from "@/lib/source-intake/types";

export const runtime = "nodejs";

function isValidSourceType(value: unknown): value is SourceIntakeCreateInput["sourceType"] {
  return typeof value === "string" && SOURCE_TYPES.includes(value as SourceIntakeCreateInput["sourceType"]);
}

export async function GET() {
  try {
    const intakes = await listSourceIntakes();
    return NextResponse.json(
      { ok: true as const, intakes },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const sourceLabel = typeof body.sourceLabel === "string" ? body.sourceLabel.trim() : "";
  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  if (!sourceLabel) {
    return NextResponse.json({ ok: false as const, error: "sourceLabel_required" }, { status: 400 });
  }
  if (!isValidSourceType(body.sourceType)) {
    return NextResponse.json({ ok: false as const, error: "invalid_sourceType" }, { status: 400 });
  }
  if (!rawText) {
    return NextResponse.json({ ok: false as const, error: "rawText_required" }, { status: 400 });
  }

  try {
    const intake = await createSourceIntake({
      sourceLabel,
      sourceType: body.sourceType,
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
      facilityId: typeof body.facilityId === "string" ? body.facilityId : undefined,
      facilityName: typeof body.facilityName === "string" ? body.facilityName : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      rawText,
    });
    return NextResponse.json({ ok: true as const, intake });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
