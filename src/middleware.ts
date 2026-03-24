import { NextRequest, NextResponse } from "next/server";
import {
  canAccessAdmin,
  canAccessRoute,
  getSessionUserFromToken,
  isAdminRoute,
  isAuthRoute,
  isPublicRoute,
} from "@/lib/auth/access";
import { getSessionSecret } from "@/lib/auth/config";
import { SESSION_COOKIE } from "@/lib/auth/session";

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isIgnoredPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    // Public folder assets (do not run auth / session-secret checks on these)
    /\.(?:png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf|eot|pdf|txt|map|mp4|webm)$/i.test(pathname)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname) || isAuthRoute(pathname)) {
    return NextResponse.next();
  }

  /** Dev-only: curl / IDE fetch without cookies — never in production (see dataset route). */
  if (
    pathname === "/api/admin/live-units/dataset" &&
    process.env.NODE_ENV !== "production" &&
    process.env.LIVE_UNITS_DEBUG_BYPASS === "1"
  ) {
    return NextResponse.next();
  }

  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    return new NextResponse("Admin session auth is not configured.", { status: 503 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value || "";
  const sessionUser = await getSessionUserFromToken(token);

  if (!canAccessRoute(pathname, sessionUser)) {
    if (isApiPath(pathname)) {
      const status = sessionUser && isAdminRoute(pathname) && !canAccessAdmin(sessionUser) ? 403 : 401;
      return NextResponse.json(
        { ok: false, error: status === 403 ? "forbidden" : "unauthorized" },
        { status }
      );
    }

    const loginUrl = req.nextUrl.clone();
    if (sessionUser && isAdminRoute(pathname) && !canAccessAdmin(sessionUser)) {
      loginUrl.pathname = "/admin/markets";
      loginUrl.search = "";
    } else {
      if (pathname.startsWith("/auth/login")) {
        return NextResponse.next();
      }
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

