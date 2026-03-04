import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/api/admin", "/dashboard"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Restricted Area"',
      "Cache-Control": "no-store",
    },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseBasicAuth(authHeader: string | null): { user: string; pass: string } | null {
  if (!authHeader) return null;
  const [scheme, encoded] = authHeader.split(" ");
  if (!scheme || !encoded || scheme.toLowerCase() !== "basic") return null;

  try {
    const decoded = atob(encoded);
    const sepIdx = decoded.indexOf(":");
    if (sepIdx < 0) return null;
    return {
      user: decoded.slice(0, sepIdx),
      pass: decoded.slice(sepIdx + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const expectedUser = process.env.ADMIN_BASIC_USER || "";
  const expectedPass = process.env.ADMIN_BASIC_PASS || "";

  // Fail closed if auth env vars are missing.
  if (!expectedUser || !expectedPass) {
    return new NextResponse("Admin auth is not configured.", { status: 503 });
  }

  const parsed = parseBasicAuth(req.headers.get("authorization"));
  if (!parsed) return unauthorizedResponse();

  if (!safeEqual(parsed.user, expectedUser) || !safeEqual(parsed.pass, expectedPass)) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/dashboard/:path*"],
};

