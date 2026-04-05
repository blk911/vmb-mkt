import { NextResponse } from "next/server";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { normalizeSocialUrl, verifyUrlHead } from "@/lib/social-targets/verification";

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("url" in body)) {
      return NextResponse.json({ ok: false, error: "expected { url: string }" }, { status: 400 });
    }
    const url = String((body as { url: unknown }).url ?? "").trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }
    if (!normalizeSocialUrl(url)) {
      return NextResponse.json(
        { ok: false, error: "url host not allowed (instagram, tiktok, linktr.ee only)" },
        { status: 400 }
      );
    }

    const result = await verifyUrlHead(url);
    return NextResponse.json({ ok: true as const, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
