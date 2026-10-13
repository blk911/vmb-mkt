import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { collectReviewExport, ReviewExportError } from "@/lib/admin/review-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Origin",
  "X-Content-Type-Options": "nosniff",
};

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: PRIVATE_HEADERS });
}

// A warm-instance guard avoids overlapping clicks. It is not a global rate limit.
let exportInProgress = false;

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromCookieHeader(request.headers.get("cookie") || "");
  if (!user) return failure("unauthorized", 401);
  if (!canAccessAdmin(user)) return failure("forbidden", 403);

  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== url.origin || (fetchSite && fetchSite !== "same-origin") || request.headers.get("x-mkt-review-export") !== "v1") {
    return failure("same_origin_required", 403);
  }
  if (url.search) return failure("parameters_not_supported", 400);
  if (exportInProgress) return failure("export_in_progress", 409);

  exportInProgress = true;
  try {
    const result = await collectReviewExport();
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mkt-review-metadata.json"',
      },
    });
  } catch (error) {
    // Never expose SDK messages, credentials, document content or stack traces.
    if (error instanceof ReviewExportError) {
      return failure(error.code, error.code === "TIMEOUT" ? 504 : error.status === "truncated" ? 413 : 503);
    }
    return failure("export_failed", 503);
  } finally {
    exportInProgress = false;
  }
}
