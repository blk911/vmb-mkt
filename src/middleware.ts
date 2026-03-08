import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, canAccessRoute, getSessionUserFromToken, isAdminRoute } from "@/lib/auth/access";
import { getSessionSecret } from "@/lib/auth/config";
import { SESSION_COOKIE } from "@/lib/auth/session";

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dashboard/:path*",
    "/api/targets/:path*",
    "/api/derived/:path*",
    "/team",
    "/team/:path*",
  ],
};

