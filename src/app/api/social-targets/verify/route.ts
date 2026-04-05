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

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      targetId?: string;
      targetIds?: string[];
      candidateId?: string;
      allCandidates?: boolean;
    };
    const ids = Array.isArray(body.targetIds)
      ? body.targetIds
      : body.targetId
        ? [body.targetId]
        : [];
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "targetId or targetIds required" }, { status: 400 });
    }

    const targets = await getMergedSocialTargets();
    const keys: string[] = [];

    for (const tid of ids) {
      const idx = targets.findIndex((t) => t.id === tid);
      if (idx === -1) continue;
      let nt = normalizeSocialTarget(targets[idx]);
      nt = ensureSocialCandidates(nt);
      const list =
        body.allCandidates === true
          ? nt.socialCandidates ?? []
          : body.candidateId
            ? (nt.socialCandidates ?? []).filter((c) => c.id === body.candidateId)
            : [getPrimaryCandidate(nt)].filter(Boolean);
      for (const c of list) {
        const r = await verifySocialCandidate(c);
        nt = normalizeSocialTarget(applyVerificationToCandidate(nt, c.id, r, { autoVerify: true }));
        keys.push(`${tid}:${c.id}`);
      }
      targets[idx] = nt;
    }

    await saveMergedSocialTargetsAsRuntime(targets);
    return NextResponse.json({ ok: true as const, verified: keys.length, keys });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
