import { NextResponse } from "next/server";
import { revalidateTargetCandidates } from "@/lib/social-targets/revalidation-runner";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const targets = await getMergedSocialTargets();
    const idx = targets.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: "target not found" }, { status: 404 });
    }
    const { target, outcome } = await revalidateTargetCandidates(targets[idx], { mode: "all" });
    targets[idx] = target;
    await saveMergedSocialTargetsAsRuntime(targets);
    return NextResponse.json({
      ok: true as const,
      target,
      revalidation: outcome,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
