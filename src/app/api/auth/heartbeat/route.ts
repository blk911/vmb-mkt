import { NextResponse } from "next/server";
import { getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { getSessionSecret } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";

export async function POST(req: Request) {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }

  const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!sessionUser) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const refreshed = await createSessionToken(sessionUser.username, sessionUser.role, sessionSecret);
  const res = NextResponse.json({ ok: true, role: sessionUser.role });
  res.cookies.set(SESSION_COOKIE, refreshed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

