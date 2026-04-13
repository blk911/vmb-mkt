import { NextResponse } from "next/server";
import { getImportedProfileDraftById } from "@/lib/external-site-import/store";
import { promoteDraftToImportedSalonRecord } from "@/lib/imported-salon-records/promote-draft";
import {
  appendImportedSalonRecord,
  getImportedSalonRecordBySourceDraftId,
} from "@/lib/imported-salon-records/store";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await ctx.params;
    const id = decodeURIComponent(draftId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "draftId_required" }, { status: 400 });
    }

    const draft = await getImportedProfileDraftById(id);
    if (!draft) {
      return NextResponse.json({ ok: false as const, error: "draft_not_found" }, { status: 404 });
    }
    if (draft.status !== "ready") {
      return NextResponse.json({ ok: false as const, error: "draft_not_ready" }, { status: 400 });
    }

    const existing = await getImportedSalonRecordBySourceDraftId(draft.id);
    if (existing) {
      return NextResponse.json({ ok: false as const, error: "already_promoted" }, { status: 409 });
    }

    const record = promoteDraftToImportedSalonRecord(draft);
    await appendImportedSalonRecord(record);
    return NextResponse.json({ ok: true as const, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "promotion_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
