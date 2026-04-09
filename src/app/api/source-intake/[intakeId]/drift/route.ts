import { NextResponse } from "next/server";
import { computeIntakeDrift } from "@/lib/source-intake/drift";
import { listDriftEventsForIntakeId } from "@/lib/source-intake/phase2-store";

export const runtime = "nodejs";

async function resolveIntakeId(paramsPromise: Promise<{ intakeId: string }>): Promise<string> {
  const { intakeId } = await paramsPromise;
  return decodeURIComponent(intakeId || "").trim();
}

export async function GET(_req: Request, ctx: { params: Promise<{ intakeId: string }> }) {
  try {
    const intakeId = await resolveIntakeId(ctx.params);
    if (!intakeId) {
      return NextResponse.json({ ok: false as const, error: "missing_intakeId" }, { status: 400 });
    }
    const events = await listDriftEventsForIntakeId(intakeId);
    return NextResponse.json({ ok: true as const, events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ intakeId: string }> }) {
  try {
    const intakeId = await resolveIntakeId(ctx.params);
    if (!intakeId) {
      return NextResponse.json({ ok: false as const, error: "missing_intakeId" }, { status: 400 });
    }
    const event = await computeIntakeDrift(intakeId);
    return NextResponse.json({ ok: true as const, event });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
