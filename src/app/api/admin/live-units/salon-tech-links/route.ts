import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import {
  clearSalonTechLinkReview,
  readSalonTechLinksReviewState,
  upsertSalonTechLinkReview,
  type SalonTechReviewStatus,
} from "@/app/admin/_lib/live-units/salon-tech-links-review-state";

const VALID_STATUSES = new Set<SalonTechReviewStatus>(["confirmed", "rejected", "watch"]);

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, reviewState: readSalonTechLinksReviewState() });
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
    const entityId = String(body?.entity_id || "").trim();
    const techId = String(body?.tech_id || "").trim();
    const reviewStatus = String(body?.review_status || "").trim() as SalonTechReviewStatus;
    const clear = Boolean(body?.clear);
    const note = typeof body?.note === "string" ? body.note.trim() : undefined;

    if (!entityId || !techId) {
      return NextResponse.json({ ok: false, error: "missing entity_id or tech_id" }, { status: 400 });
    }

    if (clear) {
      const result = await clearSalonTechLinkReview({ entity_id: entityId, tech_id: techId });
      return NextResponse.json({ ok: true, cleared_key: result.cleared_key, reviewState: result.state });
    }

    if (!VALID_STATUSES.has(reviewStatus)) {
      return NextResponse.json({ ok: false, error: "invalid review_status" }, { status: 400 });
    }

    const result = await upsertSalonTechLinkReview({
      entity_id: entityId,
      tech_id: techId,
      review_status: reviewStatus,
      note,
      updated_by: sessionUser?.username,
    });

    return NextResponse.json({ ok: true, decision: result.decision, reviewState: result.state });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "server error" }, { status: 500 });
  }
}
