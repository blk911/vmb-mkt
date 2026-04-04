import { NextResponse } from "next/server";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import type { SocialTarget, SocialTargetStatus } from "@/types/social-target";

const STATUSES: SocialTargetStatus[] = ["new", "contacted", "qualified", "paused"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeTarget(raw: unknown): SocialTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.handle) || !isNonEmptyString(o.zone) || !isNonEmptyString(o.category)) {
    return null;
  }
  const status = o.status;
  const st: SocialTargetStatus =
    typeof status === "string" && STATUSES.includes(status as SocialTargetStatus) ? (status as SocialTargetStatus) : "new";
  const tags = Array.isArray(o.tags) ? o.tags.filter((x): x is string => typeof x === "string") : [];
  const row: SocialTarget = {
    id: o.id.trim(),
    handle: String(o.handle).trim(),
    zone: String(o.zone).trim(),
    category: String(o.category).trim(),
    status: st,
    tags,
  };
  if (typeof o.businessName === "string") row.businessName = o.businessName;
  if (typeof o.notes === "string") row.notes = o.notes;
  return row;
}

export async function GET(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const targets = await getMergedSocialTargets();
    return NextResponse.json({ ok: true as const, targets });
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
    if (!body || typeof body !== "object" || !("targets" in body)) {
      return NextResponse.json({ ok: false, error: "expected { targets: [] }" }, { status: 400 });
    }
    const arr = (body as { targets: unknown }).targets;
    if (!Array.isArray(arr)) {
      return NextResponse.json({ ok: false, error: "targets must be an array" }, { status: 400 });
    }
    const normalized: SocialTarget[] = [];
    for (const item of arr) {
      const t = normalizeTarget(item);
      if (!t) {
        return NextResponse.json(
          { ok: false, error: "each target needs id, handle, zone, category; status/tags normalized" },
          { status: 400 }
        );
      }
      normalized.push(t);
    }
    const count = await saveMergedSocialTargetsAsRuntime(normalized);
    return NextResponse.json({ ok: true as const, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
