import { NextResponse } from "next/server";
import { patchCandidate } from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import {
  SOCIAL_RESOLVE_STATUSES,
  SOCIAL_VERIFICATION_STATUSES,
  SOCIAL_VISIBILITY_STATES,
} from "@/lib/social-targets/social-profile-constants";
import type { SocialCandidate, SocialResolveStatus, SocialVerificationStatus, SocialVisibilityState } from "@/types/social-target";

function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; candidateId: string }> }) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const { id, candidateId } = await ctx.params;
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "expected JSON body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const patch: Partial<SocialCandidate> = {};
    if (isOneOf(o.resolveStatus, SOCIAL_RESOLVE_STATUSES)) patch.resolveStatus = o.resolveStatus as SocialResolveStatus;
    if (isOneOf(o.verificationStatus, SOCIAL_VERIFICATION_STATUSES)) {
      patch.verificationStatus = o.verificationStatus as SocialVerificationStatus;
    }
    if (isOneOf(o.visibilityState, SOCIAL_VISIBILITY_STATES)) {
      patch.visibilityState = o.visibilityState as SocialVisibilityState;
    }
    if (typeof o.notes === "string") patch.notes = o.notes;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "no valid fields" }, { status: 400 });
    }

    const targets = await getMergedSocialTargets();
    const idx = targets.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: "target not found" }, { status: 404 });
    }

    let nt = normalizeSocialTarget(targets[idx]);
    if (!nt.socialCandidates?.some((c) => c.id === candidateId)) {
      return NextResponse.json({ ok: false, error: "candidate not found" }, { status: 404 });
    }

    nt = normalizeSocialTarget(patchCandidate(nt, candidateId, patch));
    targets[idx] = nt;
    await saveMergedSocialTargetsAsRuntime(targets);
    return NextResponse.json({ ok: true as const, target: nt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
