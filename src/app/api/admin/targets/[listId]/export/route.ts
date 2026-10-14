import { NextResponse } from "next/server";
import { readTargetList, TargetListStoreError } from "@/app/admin/_lib/targets/store";
import { resolveTargetListMembership } from "@/app/admin/_lib/targets/catalogMembership";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { loadSharedCatalog } from "@/lib/catalog/store";
import { GET as exportCsv } from "@/app/api/targets/export/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ listId: string }> }) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessAdmin(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401 });
  const { listId } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  if (format === "csv") {
    url.searchParams.set("listId", listId);
    return exportCsv(new Request(url, { headers: req.headers }));
  }
  if (format !== "json") return NextResponse.json({ ok: false, error: "unsupported_format" }, { status: 400 });
  try {
    const list = await readTargetList(listId);
    if (!list) return NextResponse.json({ ok: false, error: "list_not_found" }, { status: 404 });
    const catalog = await loadSharedCatalog();
    const membership = resolveTargetListMembership(list, catalog.rows);
    return NextResponse.json({ ...list, resolvedMembers: membership.rows, unresolvedCatalogIds: membership.missingIds, unresolvedLegacyItems: membership.unresolvedLegacyItems, catalogCoverage: catalog.coverage, generatedAt: catalog.generatedAt }, {
      headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="targets_${list.id}.json"` },
    });
  } catch (error) {
    if (error instanceof TargetListStoreError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "shared_catalog_unavailable" }, { status: 503 });
  }
}
