import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { addReviewNote, markReady, shelveByReview } from "@/lib/operators/review-store";
import type { OperatorRecord } from "@/lib/operators/types";
import type { OperatorReviewAction } from "@/lib/operators/review-types";

type ReviewRequestBody = {
  operatorId?: string;
  action?: OperatorReviewAction;
  reviewNotes?: string;
};

function operatorExists(operatorId: string): boolean {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return false;
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as OperatorRecord[];
  return rows.some((row) => row.id === operatorId);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReviewRequestBody;
    const operatorId = typeof body.operatorId === "string" ? body.operatorId.trim() : "";
    const action = body.action;
    if (!operatorId || !action) {
      return NextResponse.json({ ok: false as const, error: "Missing operatorId or action" }, { status: 400 });
    }
    if (!operatorExists(operatorId)) {
      return NextResponse.json({ ok: false as const, error: "Operator not found" }, { status: 404 });
    }

    let updated;
    if (action === "markReady") updated = markReady(operatorId);
    else if (action === "shelveByReview") updated = shelveByReview(operatorId);
    else updated = addReviewNote(operatorId, typeof body.reviewNotes === "string" ? body.reviewNotes.trim() : "");

    return NextResponse.json({ ok: true as const, review: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

