import { NextRequest, NextResponse } from "next/server";
import { getSessionSecret } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

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
  const valid = token ? await verifySessionToken(token, sessionSecret) : null;
  if (valid) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/dashboard/:path*", "/api/targets/:path*", "/api/derived/:path*"],
};

