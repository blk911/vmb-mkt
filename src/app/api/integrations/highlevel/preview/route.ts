import { NextResponse } from "next/server";
import { loadTargetWorkflowLists } from "@/app/admin/_lib/targets/workflowLists";
import { TargetListStoreError } from "@/app/admin/_lib/targets/store";
import { buildHighLevelHandoffPreview } from "@/lib/ops/targetWorkflow";
import { canAccessMemberArea, getSessionUserFromCookieHeader } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401, headers });
  try {
    const shared = await loadTargetWorkflowLists();
    return NextResponse.json({
      ok: true, payload: buildHighLevelHandoffPreview(shared.lists),
      coverage: shared.coverage, catalogCoverage: shared.catalogCoverage,
    }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof TargetListStoreError ? error.code : "shared_catalog_unavailable" }, { status: error instanceof TargetListStoreError ? error.status : 503, headers });
  }
}
