import { NextResponse } from "next/server";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedReferralEdges, saveMergedReferralEdgesAsRuntime } from "@/lib/social-targets/referral-edges-store";
import type { ReferralCategory, ReferralConfidence, ReferralEdge } from "@/types/social-target";

const REFERRAL_CATEGORIES: ReferralCategory[] = ["nails", "hair", "lashes", "brows", "spa", "other"];
const CONFIDENCE: ReferralConfidence[] = ["single", "multi"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeEdge(raw: unknown): ReferralEdge | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(o.id) ||
    !isNonEmptyString(o.fromTargetId) ||
    !isNonEmptyString(o.fromHandle) ||
    !isNonEmptyString(o.toHandle) ||
    !isNonEmptyString(o.createdAt)
  ) {
    return null;
  }
  const cat = o.referredCategory;
  if (typeof cat !== "string" || !REFERRAL_CATEGORIES.includes(cat as ReferralCategory)) return null;
  const conf = o.confidence;
  if (typeof conf !== "string" || !CONFIDENCE.includes(conf as ReferralConfidence)) return null;
  const timesSeen = o.timesSeen;
  if (typeof timesSeen !== "number" || !Number.isFinite(timesSeen) || timesSeen < 0) return null;

  const edge: ReferralEdge = {
    id: o.id.trim(),
    fromTargetId: String(o.fromTargetId).trim(),
    fromHandle: String(o.fromHandle).replace(/^@/, "").trim(),
    toHandle: String(o.toHandle).replace(/^@/, "").trim(),
    referredCategory: cat as ReferralCategory,
    confidence: conf as ReferralConfidence,
    timesSeen: Math.floor(timesSeen),
    createdAt: String(o.createdAt).trim(),
  };
  if (typeof o.toTargetId === "string" && o.toTargetId.trim()) edge.toTargetId = o.toTargetId.trim();
  if (typeof o.note === "string") edge.note = o.note;
  return edge;
}

export async function GET(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const edges = await getMergedReferralEdges();
    return NextResponse.json({ ok: true as const, edges });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("edges" in body)) {
      return NextResponse.json({ ok: false, error: "expected { edges: [] }" }, { status: 400 });
    }
    const arr = (body as { edges: unknown }).edges;
    if (!Array.isArray(arr)) {
      return NextResponse.json({ ok: false, error: "edges must be an array" }, { status: 400 });
    }
    const normalized: ReferralEdge[] = [];
    for (const item of arr) {
      const e = normalizeEdge(item);
      if (!e) {
        return NextResponse.json(
          { ok: false, error: "each edge needs id, fromTargetId, fromHandle, toHandle, referredCategory, confidence, timesSeen, createdAt" },
          { status: 400 }
        );
      }
      normalized.push(e);
    }
    const count = await saveMergedReferralEdgesAsRuntime(normalized);
    return NextResponse.json({ ok: true as const, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
