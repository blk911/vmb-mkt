import { NextResponse } from "next/server";
import { listTargetLists, readTargetList } from "@/app/admin/_lib/targets/store";
import { buildHighLevelHandoffPreview } from "@/lib/ops/targetWorkflow";

async function getDashboardLists() {
  const index = await listTargetLists();
  const techIds = index.lists.filter((list) => list.scope === "tech").map((list) => list.id);

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
        };
      })
    )
  ).filter(Boolean);

  return lists;
}

export async function GET() {
  const payload = buildHighLevelHandoffPreview(await getDashboardLists());
  return NextResponse.json({ ok: true, payload }, { status: 200 });
}
