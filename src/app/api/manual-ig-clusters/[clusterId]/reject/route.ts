import { NextResponse } from "next/server";
import { updateManualIgClusterItemStatus } from "@/lib/manual-ig-clusters/store";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ clusterId: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { clusterId } = await ctx.params;
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!clusterId) {
      return NextResponse.json({ ok: false as const, error: "clusterId_required" }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ ok: false as const, error: "itemId_required" }, { status: 400 });
    }
    const cluster = await updateManualIgClusterItemStatus({
      clusterId,
      itemId,
      status: "rejected",
    });
    return NextResponse.json({ ok: true as const, cluster });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "cluster_not_found" ? 404 : message === "cluster_item_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
