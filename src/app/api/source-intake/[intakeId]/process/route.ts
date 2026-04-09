import { NextResponse } from "next/server";
import { processSourceIntake } from "@/lib/source-intake/process";
import {
  getSourceIntakeById,
  listParsedCandidates,
  saveParsedCandidates,
} from "@/lib/source-intake/store";
import { REVIEW_ACTIONS, type ReviewAction } from "@/lib/source-intake/types";

export const runtime = "nodejs";

type ProcessBody = {
  reviewActions?: Array<{
    candidateId: string;
    reviewAction: ReviewAction;
  }>;
};

function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === "string" && REVIEW_ACTIONS.includes(value as ReviewAction);
}

export async function POST(req: Request, ctx: { params: Promise<{ intakeId: string }> }) {
  let body: ProcessBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ProcessBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

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

    const existingRows = await listParsedCandidates(id);
    if (!existingRows.length) {
      return NextResponse.json({ ok: false as const, error: "parsed_candidates_required" }, { status: 400 });
    }

    if (Array.isArray(body.reviewActions) && body.reviewActions.length) {
      const actionMap = new Map<string, ReviewAction>();
      for (const item of body.reviewActions) {
        if (!item || typeof item.candidateId !== "string" || !isReviewAction(item.reviewAction)) {
          return NextResponse.json({ ok: false as const, error: "invalid_reviewActions" }, { status: 400 });
        }
        actionMap.set(item.candidateId, item.reviewAction);
      }
      const updatedRows = existingRows.map((row) => ({
        ...row,
        reviewAction: actionMap.get(row.id) ?? row.reviewAction ?? "pending",
      }));
      await saveParsedCandidates(id, updatedRows);
    }

    const receipt = await processSourceIntake(id);
    return NextResponse.json({ ok: true as const, receipt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
