import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import {
  applyReviewDecisions,
  readReviewState,
  upsertReviewDecision,
  type ReviewStatus,
} from "@/app/admin/_lib/live-units/review-state";

const VALID_STATUSES = new Set<ReviewStatus>(["approved", "rejected", "watch", "needs_research"]);

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, reviewState: readReviewState() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const liveUnitIds = Array.isArray(body?.live_unit_ids)
      ? body.live_unit_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];
    const clear = Boolean(body?.clear);
    const liveUnitId = String(body?.live_unit_id || "").trim();
    const reviewStatus = String(body?.review_status || "").trim() as ReviewStatus;

    if (liveUnitIds.length) {
      if (!clear && !VALID_STATUSES.has(reviewStatus)) {
        return NextResponse.json({ ok: false, error: "invalid review_status" }, { status: 400 });
      }

      const result = await applyReviewDecisions({
        live_unit_ids: liveUnitIds,
        review_status: clear ? undefined : reviewStatus,
        clear,
        updated_by: sessionUser?.username,
      });

      return NextResponse.json({
        ok: true,
        changed: result.changed,
        reviewState: result.state,
      });
    }

    if (!liveUnitId) {
      return NextResponse.json({ ok: false, error: "missing live_unit_id" }, { status: 400 });
    }

    if (!clear && !VALID_STATUSES.has(reviewStatus)) {
      return NextResponse.json({ ok: false, error: "invalid review_status" }, { status: 400 });
    }

    if (clear) {
      const result = await applyReviewDecisions({
        live_unit_ids: [liveUnitId],
        clear: true,
        updated_by: sessionUser?.username,
      });

      return NextResponse.json({
        ok: true,
        changed: result.changed,
        reviewState: result.state,
      });
    }

    const result = await upsertReviewDecision({
      live_unit_id: liveUnitId,
      review_status: reviewStatus,
      updated_by: sessionUser?.username,
    });

    return NextResponse.json({
      ok: true,
      decision: result.decision,
      reviewState: result.state,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "server error" }, { status: 500 });
  }
}
