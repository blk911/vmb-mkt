import { NextResponse } from "next/server";
import { listTargetLists, readTargetList } from "@/app/admin/_lib/targets/store";
import { listAccessRequests } from "@/lib/access/requestAccessStore";
import { buildHighLevelHandoffPreview, summarizeWorkflowLists } from "@/lib/ops/targetWorkflow";

async function getDashboardLists() {
  const index = await listTargetLists();
  const techIds = index.lists
    .filter((list) => list.scope === "tech")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((list) => list.id);

  const lists = (
    await Promise.all(
      techIds.map(async (id) => {
        const list = await readTargetList(id);
        if (!list || list.scope !== "tech") return null;
        return {
          id: list.id,
          name: list.name,
          updatedAt: list.updatedAt,
          techIds: list.items.filter((item) => item.kind === "tech").map((item) => item.refId),
          workflow: list.workflow,
          activity: list.activity,
        };
      })
    )
  ).filter(Boolean);

  return lists;
}

export async function GET() {
  const [lists, accessRequests] = await Promise.all([getDashboardLists(), listAccessRequests()]);
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: summarizeWorkflowLists(lists),
      highLevelPreview: buildHighLevelHandoffPreview(lists),
      accessRequests: {
        total: accessRequests.requests.length,
        pending: accessRequests.requests.filter((request) => request.status === "pending").length,
      },
      lists,
    },
    { status: 200 }
  );
}
