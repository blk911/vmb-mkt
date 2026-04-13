import { NextResponse } from "next/server";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";
import { isImportedProfileReviewPayload } from "@/lib/external-site-review/types";
import {
  getImportedProfileDraftById,
  updateImportedDraftDecisionStatus,
  updateImportedDraftReview,
  updateImportedProfileDraftStatus,
} from "@/lib/external-site-import/store";
import type { ImportedProfileDraftStatus } from "@/lib/external-site-import/types";

export const runtime = "nodejs";

function isDraftStatus(value: unknown): value is ImportedProfileDraftStatus {
  return value === "draft" || value === "reviewed" || value === "ready" || value === "rejected";
}

function isDecisionStatus(value: unknown): value is ImportDecisionStatus {
  return value === "unresolved" || value === "standalone" || value === "likely_duplicate" || value === "merge_candidate";
}

export async function GET(_req: Request, ctx: { params: Promise<{ draftId: string }> }) {
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
    return NextResponse.json(
      { ok: true as const, draft },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  let body: { status?: string; review?: unknown; decisionStatus?: string };
  try {
    body = (await req.json()) as { status?: string; review?: unknown; decisionStatus?: string };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { draftId } = await ctx.params;
    const id = decodeURIComponent(draftId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "draftId_required" }, { status: 400 });
    }
    const providedModes = [body.status !== undefined, body.review !== undefined, body.decisionStatus !== undefined].filter(Boolean).length;
    if (providedModes > 1) {
      return NextResponse.json({ ok: false as const, error: "patch_one_mode_only" }, { status: 400 });
    }
    let draft;
    if (body.status !== undefined) {
      if (!isDraftStatus(body.status)) {
        return NextResponse.json({ ok: false as const, error: "invalid_status" }, { status: 400 });
      }
      draft = await updateImportedProfileDraftStatus(id, body.status);
    } else if (body.review !== undefined) {
      if (!isImportedProfileReviewPayload(body.review)) {
        return NextResponse.json({ ok: false as const, error: "invalid_review_payload" }, { status: 400 });
      }
      draft = await updateImportedDraftReview(id, body.review);
    } else if (body.decisionStatus !== undefined) {
      if (!isDecisionStatus(body.decisionStatus)) {
        return NextResponse.json({ ok: false as const, error: "invalid_decision_status" }, { status: 400 });
      }
      draft = await updateImportedDraftDecisionStatus(id, body.decisionStatus);
    } else {
      return NextResponse.json({ ok: false as const, error: "patch_payload_required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true as const, draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "draft_update_failed";
    const status = message === "draft_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
