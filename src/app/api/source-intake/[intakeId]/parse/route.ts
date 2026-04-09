import { NextResponse } from "next/server";
import { buildCandidateMatchSuggestions } from "@/lib/source-intake/matcher";
import { parseSourceIntakeText } from "@/lib/source-intake/parser";
import {
  getSourceIntakeById,
  saveParsedCandidates,
  updateSourceIntake,
} from "@/lib/source-intake/store";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ intakeId: string }> }) {
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

    const parsed = parseSourceIntakeText(intake);
    const candidates = await buildCandidateMatchSuggestions(intake, parsed);
    await saveParsedCandidates(id, candidates);

    const parsedAt = new Date().toISOString();
    const updatedIntake = await updateSourceIntake(id, {
      status: "parsed",
      parseSummary: {
        totalCandidates: candidates.length,
        parsedAt,
      },
    });

    return NextResponse.json({ ok: true as const, intake: updatedIntake, parsedCandidates: candidates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
