import { NextResponse } from "next/server";
import { getSessionSecret } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/auth/session";

export async function POST(req: Request) {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const tokenPart = cookieHeader
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${SESSION_COOKIE}=`));
  const token = tokenPart ? tokenPart.slice(SESSION_COOKIE.length + 1) : "";
  if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const payload = await verifySessionToken(token, sessionSecret);
  if (!payload) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const refreshed = await createSessionToken(payload.u, sessionSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, refreshed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

