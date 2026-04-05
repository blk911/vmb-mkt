import { NextResponse } from "next/server";
import { runValidationPull, type ValidationPullInput } from "@/lib/social-targets/run-validation-pull";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";

function normalizeBody(raw: unknown): ValidationPullInput {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const targetIds = Array.isArray(o.targetIds)
    ? o.targetIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : undefined;
  const sourceVersion = typeof o.sourceVersion === "string" && o.sourceVersion.trim() ? o.sourceVersion.trim() : undefined;
  const runType =
    o.runType === "validation" || o.runType === "scale" || o.runType === "adhoc" ? o.runType : undefined;
  const googleResultsByTarget =
    o.googleResultsByTarget && typeof o.googleResultsByTarget === "object"
      ? (o.googleResultsByTarget as ValidationPullInput["googleResultsByTarget"])
      : undefined;
  return {
    ...(targetIds ? { targetIds } : {}),
    ...(sourceVersion ? { sourceVersion } : {}),
    ...(runType ? { runType } : {}),
    ...(googleResultsByTarget ? { googleResultsByTarget } : {}),
  };
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const output = await runValidationPull(body);
    return NextResponse.json({ ok: true as const, ...output });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
