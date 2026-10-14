import { NextResponse } from "next/server";
import { loadTargetWorkflowLists } from "@/app/admin/_lib/targets/workflowLists";
import { TargetListStoreError } from "@/app/admin/_lib/targets/store";
import { listAccessRequests } from "@/lib/access/requestAccessStore";
import { buildHighLevelHandoffPreview, summarizeWorkflowLists } from "@/lib/ops/targetWorkflow";
import { canAccessMemberArea, getSessionUserFromCookieHeader } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401, headers });
  try {
    const [shared, accessRequests] = await Promise.all([loadTargetWorkflowLists(), listAccessRequests()]);
    return NextResponse.json({
      ok: true, generatedAt: shared.generatedAt,
      summary: summarizeWorkflowLists(shared.lists),
      highLevelPreview: buildHighLevelHandoffPreview(shared.lists),
      accessRequests: { total: accessRequests.requests.length, pending: accessRequests.requests.filter((request) => request.status === "pending").length },
      lists: shared.lists, coverage: shared.coverage, catalogCoverage: shared.catalogCoverage,
    }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof TargetListStoreError ? error.code : "ops_report_unavailable" }, { status: error instanceof TargetListStoreError ? error.status : 503, headers });
  }
}
