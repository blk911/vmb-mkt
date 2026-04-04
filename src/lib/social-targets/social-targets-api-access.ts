import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";

export function isSocialTargetsDevBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VMB_DEV_BYPASS_SOCIAL_TARGETS === "true";
}

/** Returns NextResponse error if not allowed; otherwise null. */
export async function assertSocialTargetsApiAccess(req: Request): Promise<NextResponse | null> {
  if (isSocialTargetsDevBypass()) return null;
  const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessAdmin(sessionUser)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return null;
}
