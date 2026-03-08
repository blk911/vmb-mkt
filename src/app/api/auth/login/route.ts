import { NextResponse } from "next/server";
import { resolveRoleForUser } from "@/lib/auth/access";
import { getAdminPass, getAdminUser, getSessionSecret } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";

type Body = {
  user?: string;
  pass?: string;
  next?: string;
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const adminUser = getAdminUser();
  const adminPass = getAdminPass();
  const sessionSecret = getSessionSecret();
  if (!adminUser || !adminPass || !sessionSecret) {
    return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const nextPath = "/admin/markets";

  if (!safeEqual(user, adminUser) || !safeEqual(pass, adminPass)) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const role = resolveRoleForUser(user);
  const token = await createSessionToken(user, role, sessionSecret);
  const res = NextResponse.json({ ok: true, next: nextPath, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

