import { NextResponse } from "next/server";
import { readTargetList, TargetListStoreError } from "@/app/admin/_lib/targets/store";
import { targetListCatalogCsv } from "@/app/admin/_lib/targets/catalogMembership";
import { canAccessMemberArea, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { loadSharedCatalog } from "@/lib/catalog/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401 });
  const url = new URL(req.url);
  const listId = (url.searchParams.get("listId") || "").trim();
  const format = (url.searchParams.get("format") || "csv").trim().toLowerCase();
  if (!listId) return NextResponse.json({ ok: false, error: "missing_listId" }, { status: 400 });
  if (format !== "csv") return NextResponse.json({ ok: false, error: "unsupported_format", format }, { status: 400 });
  try {
    const list = await readTargetList(listId);
    if (!list) return NextResponse.json({ ok: false, error: "list_not_found", listId }, { status: 404 });
    const catalog = await loadSharedCatalog();
    const { csv, membership } = targetListCatalogCsv(list, catalog.rows, catalog.generatedAt);
    const safeName = list.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "targets";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}_${list.id}.csv"`,
        "Cache-Control": "no-store",
        "X-List-Membership-Mode": list.membershipMode,
        "X-Catalog-Coverage-Complete": String(catalog.coverage.complete),
        "X-Unresolved-Member-Count": String(membership.missingIds.length + membership.unresolvedLegacyItems.length),
      },
    });
  } catch (error) {
    if (error instanceof TargetListStoreError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "shared_catalog_unavailable", message: "The current shared catalog could not be loaded. No local data fallback was used." }, { status: 503 });
  }
}
