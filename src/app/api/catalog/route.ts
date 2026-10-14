import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessMemberArea, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { loadSharedCatalog } from "@/lib/catalog/store";
import { filterCatalogRecords, normalizeCatalogFilters, sortCatalogRecords } from "@/lib/catalog/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401, headers });
  try {
    const catalog = await loadSharedCatalog();
    const viewer = { canReview: canAccessAdmin(user) };
    const params = new URL(req.url).searchParams;
    if (params.get("id")) {
      const record = catalog.rows.find((row) => row.id === params.get("id"));
      return NextResponse.json(record ? { ok: true, record, viewer, coverage: catalog.coverage, generatedAt: catalog.generatedAt } : { ok: false, error: "not_found" }, { status: record ? 200 : 404, headers });
    }
    const filters = normalizeCatalogFilters(Object.fromEntries(params));
    return NextResponse.json({ ok: true, ...catalog, viewer, rows: sortCatalogRecords(filterCatalogRecords(catalog.rows, filters), filters) }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: "catalog_store_unavailable", message: "The shared catalog could not be read. No local fallback has been used. Retry when the shared store is available." }, { status: 503, headers });
  }
}
