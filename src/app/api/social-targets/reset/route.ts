import { NextResponse } from "next/server";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { saveRuntimeReferralEdges } from "@/lib/social-targets/referral-edges-store";
import { saveRuntimeSocialTargets } from "@/lib/social-targets/social-targets-store";

/** Dev / admin: clear runtime overlays so the next load uses seed JSON only. */
export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    await saveRuntimeSocialTargets([]);
    await saveRuntimeReferralEdges([]);
    return NextResponse.json({ ok: true as const });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
