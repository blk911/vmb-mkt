import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { getAdminUser, getSessionSecret } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export type Role = "public" | "member" | "admin";

export type SessionUser = {
  username: string;
  role: Role;
} | null;

type SessionPayloadLike = {
  u: string;
  role?: string | null;
} | null;

export const PUBLIC_ROUTES = ["/", "/marketing", "/marketing-decks"];
export const MEMBER_ROUTES = ["/admin/markets", "/dashboard", "/team", "/api/targets", "/api/derived"];
export const ADMIN_ROUTES = ["/admin", "/api/admin"];
export const AUTH_ROUTES = ["/auth", "/api/auth"];

function routeMatches(pathname: string, prefix: string) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveRoleForUser(username: string): Role {
  return username === getAdminUser() ? "admin" : "member";
}

export function sessionUserFromPayload(payload: SessionPayloadLike): SessionUser {
  if (!payload?.u) return null;
  return {
    username: payload.u,
    role: payload.role === "admin" || payload.role === "member" ? payload.role : resolveRoleForUser(payload.u),
  };
}

export function isAuthenticated(user: SessionUser) {
  return !!user;
}

export function isAdmin(user: SessionUser) {
  return user?.role === "admin";
}

export function canAccessMemberArea(user: SessionUser) {
  return !!user;
}

export function canAccessAdmin(user: SessionUser) {
  return user?.role === "admin";
}

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((p) => routeMatches(pathname, p));
}

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => routeMatches(pathname, p));
}

export function isMemberRoute(pathname: string) {
  return MEMBER_ROUTES.some((p) => routeMatches(pathname, p));
}

export function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some((p) => routeMatches(pathname, p));
}

export function canAccessRoute(pathname: string, user: SessionUser): boolean {
  if (isPublicRoute(pathname) || isAuthRoute(pathname)) return true;

  if (isAdminRoute(pathname)) {
    if (routeMatches(pathname, "/admin/markets")) return !!user;
    return isAdmin(user);
  }

  if (isMemberRoute(pathname)) {
    return !!user;
  }

  return true;
}

export function canShowNavItem(id: string, user: SessionUser): boolean {
  if (id === "marketing") return true;
  if (id === "login") return !user;
  if (id === "markets") return !!user;
  if (id === "liveunits") return user?.role === "admin";
  if (id === "datastore") return !!user;
  if (id === "team") return !!user;
  if (id === "admin") return user?.role === "admin";
  return false;
}

export function extractSessionTokenFromCookieHeader(cookieHeader: string): string {
  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1) || ""
  );
}

export async function getSessionUserFromToken(token: string): Promise<SessionUser> {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret || !token) return null;
  const payload = await verifySessionToken(token, sessionSecret);
  return sessionUserFromPayload(payload);
}

export async function getSessionUserFromCookieHeader(cookieHeader: string): Promise<SessionUser> {
  return getSessionUserFromToken(extractSessionTokenFromCookieHeader(cookieHeader));
}

export async function getSessionUserFromCookies(cookieStore: Pick<ReadonlyRequestCookies, "get">): Promise<SessionUser> {
  return getSessionUserFromToken(cookieStore.get(SESSION_COOKIE)?.value || "");
}
