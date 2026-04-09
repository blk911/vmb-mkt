import { NextResponse } from "next/server";
import {
  listDoraQueueByIntakeId,
  listDoraResults,
  listDriftEventsForIntakeId,
  listOperatorCandidateLinksByCandidateIds,
  listSocialQueueByIntakeId,
  listSocialResults,
} from "@/lib/source-intake/phase2-store";
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

    const [
      parsedCandidates,
      processingReceipts,
      doraQueueItems,
      allDoraResults,
      socialQueueItems,
      allSocialResults,
      driftEvents,
    ] = await Promise.all([
      listParsedCandidates(id),
      listProcessingReceipts(id),
      listDoraQueueByIntakeId(id),
      listDoraResults(),
      listSocialQueueByIntakeId(id),
      listSocialResults(),
      listDriftEventsForIntakeId(id),
    ]);
    const candidateIds = parsedCandidates.map((row) => row.id);
    const operatorCandidateLinks = await listOperatorCandidateLinksByCandidateIds(candidateIds);
    const doraResults = allDoraResults.filter((row) => row.intakeId === id);
    const socialResults = allSocialResults.filter((row) => row.intakeId === id);
    const latestDriftEvent = driftEvents[0] ?? null;

    return NextResponse.json(
      {
        ok: true as const,
        intake,
        parsedCandidates,
        processingReceipts,
        doraQueueItems,
        doraResults,
        socialQueueItems,
        socialResults,
        driftEvents,
        latestDriftEvent,
        operatorCandidateLinks,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
