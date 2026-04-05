import { NextResponse } from "next/server";
import { revalidateTargetCandidates, type RevalidateMode } from "@/lib/social-targets/revalidation-runner";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";

type BodyShape = {
  targetId?: string;
  targetIds?: string[];
  candidateId?: string;
  mode?: RevalidateMode;
  staleOnly?: boolean;
};

function modeFromBody(body: BodyShape): RevalidateMode {
  if (body.mode) return body.mode;
  if (body.staleOnly === true) return "stale";
  if (body.candidateId) return "selected";
  return "featured";
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as BodyShape;
    const ids = Array.isArray(body.targetIds) ? body.targetIds : body.targetId ? [body.targetId] : [];
    const mode = modeFromBody(body);
    if (!ids.length && mode !== "stale") {
      return NextResponse.json({ ok: false, error: "targetId or targetIds required unless mode=stale" }, { status: 400 });
    }
    const targets = await getMergedSocialTargets();
    const idsToProcess = ids.length ? ids : targets.map((t) => t.id);
    const outcomes: Array<{ targetId: string; candidateCount: number; featuredBefore?: string | null; featuredAfter?: string | null }> = [];

    for (const tid of idsToProcess) {
      const idx = targets.findIndex((t) => t.id === tid);
      if (idx === -1) continue;
      const { target, outcome } = await revalidateTargetCandidates(targets[idx], {
        mode,
        ...(body.candidateId ? { candidateIds: [body.candidateId] } : {}),
      });
      targets[idx] = target;
      outcomes.push({
        targetId: tid,
        candidateCount: outcome.candidateOutcomes.length,
        featuredBefore: outcome.featuredCandidateIdBefore,
        featuredAfter: outcome.featuredCandidateIdAfter,
      });
    }

    await saveMergedSocialTargetsAsRuntime(targets);
    return NextResponse.json({ ok: true as const, mode, outcomes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
