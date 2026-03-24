import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { loadLiveUnitsWithTrace } from "@/lib/live-units/live-units-loader";

/**
 * Diagnostics: same load path as `/admin/live-units` (HTTP → Firestore → artifacts).
 * Does not return row bodies unless `?full=1` (admin).
 *
 * Response duplicates key trace fields at top level for quick validation checks.
 *
 * **Auth:** All `/api/admin/*` routes require an **admin** session (`middleware.ts`).
 * If you see `{ ok: false, error: "unauthorized" }` with HTTP 401, no valid cookie was sent
 * (cookie name: `vmb_admin_session`). Log in via `/auth/login` as admin, then either:
 * - open this URL in the same browser, or
 * - `curl -b "vmb_admin_session=…" https://…/api/admin/live-units/dataset`
 * Members (non-admin) get 403 `forbidden` from middleware.
 *
 * **Dev bypass:** `LIVE_UNITS_DEBUG_BYPASS=1` and `NODE_ENV !== "production"` skips admin check here
 * (middleware must allow the path too — same env). Do not set in production.
 */
function isDatasetDebugBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LIVE_UNITS_DEBUG_BYPASS === "1";
}

export async function GET(req: Request) {
  try {
    const bypass = isDatasetDebugBypass();
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!bypass && !canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const loaded = await loadLiveUnitsWithTrace();
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1";
    const t = loaded.trace;

    return NextResponse.json({
      ok: true,
      ...(bypass ? { debugBypass: true as const } : {}),
      rowCount: loaded.rows.length,
      sourceMode: t.sourceMode,
      rowsLoadedRaw: t.rowsLoadedRaw,
      rowsAfterParse: t.rowsAfterParse,
      rowsAfterRequiredFieldGates: t.rowsAfterRequiredFieldGates,
      rowsSentToClient: t.rowsSentToClient,
      droppedMalformed: t.droppedMalformed,
      gateDropReasons: t.gateDropReasons ?? [],
      trace: loaded.trace,
      ...(full ? { rows: loaded.rows } : {}),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
