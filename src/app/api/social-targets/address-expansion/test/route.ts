import { NextResponse } from "next/server";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { runAddressExpansionTest } from "@/lib/social-targets/address-expansion/run-address-expansion-test";

type Body = {
  targetId?: string;
  address?: string;
  city?: string;
  state?: string;
};

function normalizeBody(raw: unknown): Body {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    ...(typeof o.targetId === "string" && o.targetId.trim() ? { targetId: o.targetId.trim() } : {}),
    ...(typeof o.address === "string" && o.address.trim() ? { address: o.address.trim() } : {}),
    ...(typeof o.city === "string" && o.city.trim() ? { city: o.city.trim() } : {}),
    ...(typeof o.state === "string" && o.state.trim() ? { state: o.state.trim() } : {}),
  };
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const output = await runAddressExpansionTest(body);
    return NextResponse.json({ ok: true as const, ...output });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
