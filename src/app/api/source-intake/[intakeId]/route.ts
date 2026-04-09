import { NextResponse } from "next/server";
import {
  getSourceIntakeById,
  listParsedCandidates,
  listProcessingReceipts,
} from "@/lib/source-intake/store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ intakeId: string }> }) {
  try {
    const { intakeId } = await ctx.params;
    const id = decodeURIComponent(intakeId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "missing_intakeId" }, { status: 400 });
    }

    const intake = await getSourceIntakeById(id);
    if (!intake) {
      return NextResponse.json({ ok: false as const, error: "intake_not_found" }, { status: 404 });
    }

    const [parsedCandidates, processingReceipts] = await Promise.all([
      listParsedCandidates(id),
      listProcessingReceipts(id),
    ]);

    return NextResponse.json(
      { ok: true as const, intake, parsedCandidates, processingReceipts },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
