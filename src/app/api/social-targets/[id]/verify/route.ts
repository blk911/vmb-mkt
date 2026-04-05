import { NextResponse } from "next/server";
import {
  applyVerificationToCandidate,
  ensureSocialCandidates,
  getPrimaryCandidate,
} from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import { verifySocialCandidate } from "@/lib/social-targets/social-verification";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const allCandidates = url.searchParams.get("all") === "1";

    const targets = await getMergedSocialTargets();
    const idx = targets.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: "target not found" }, { status: 404 });
    }

    let nt = normalizeSocialTarget(targets[idx]);
    nt = ensureSocialCandidates(nt);
    const list = allCandidates ? nt.socialCandidates ?? [] : [getPrimaryCandidate(nt)].filter(Boolean);
    const verifiedIds: string[] = [];

    for (const c of list) {
      const r = await verifySocialCandidate(c);
      nt = normalizeSocialTarget(applyVerificationToCandidate(nt, c.id, r, { autoVerify: true }));
      verifiedIds.push(c.id);
    }

    targets[idx] = nt;
    await saveMergedSocialTargetsAsRuntime(targets);
    return NextResponse.json({ ok: true as const, target: nt, verifiedCandidateIds: verifiedIds });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
