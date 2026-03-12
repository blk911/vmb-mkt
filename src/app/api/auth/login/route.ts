import { NextResponse } from "next/server";
import { resolveRoleForUser } from "@/lib/auth/access";
import { getConfiguredAuthUser, getConfiguredAuthUsers, getSessionSecret } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";

type Body = {
  user?: string;
  pass?: string;
  next?: string;
};

function sanitizeNextPath(next?: string) {
  const value = String(next || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "";
  }
  if (value === "/auth/login" || value.startsWith("/auth/login?")) {
    return "";
  }
  return value;
}

function defaultNextPathForRole(role: "member" | "admin" | "external") {
  if (role === "external") return "/";
  return role === "admin" ? "/admin/markets" : "/dashboard/targets";
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const users = getConfiguredAuthUsers();
  const sessionSecret = getSessionSecret();
  if (!users.length || !sessionSecret) {
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
  const nextPath = sanitizeNextPath(body.next);
  const configuredUser = getConfiguredAuthUser(user);
  if (!configuredUser || !safeEqual(pass, configuredUser.password)) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const role = resolveRoleForUser(user);
  const token = await createSessionToken(user, role, sessionSecret);
  const target =
    role === "external" && nextPath && nextPath !== "/" ? "/" : nextPath || defaultNextPathForRole(role);
  const res = NextResponse.json({ ok: true, next: target, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

