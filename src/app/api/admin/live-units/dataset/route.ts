import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { loadLiveUnitsWithTrace } from "@/lib/live-units/live-units-loader";

/**
 * Diagnostics: same load path as `/admin/live-units` (HTTP → Firestore → artifacts).
 * Does not return row bodies (use page render); returns counts + trace.
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const loaded = await loadLiveUnitsWithTrace();
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1";

    return NextResponse.json({
      ok: true,
      rowCount: loaded.rows.length,
      trace: loaded.trace,
      ...(full ? { rows: loaded.rows } : {}),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
