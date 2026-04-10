import { NextResponse } from "next/server";
import {
  appendManualIgAcceptedRecord,
  getManualIgClusterById,
  updateManualIgClusterItemStatus,
} from "@/lib/manual-ig-clusters/store";

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

    const existingCluster = await getManualIgClusterById(clusterId);
    if (!existingCluster) {
      return NextResponse.json({ ok: false as const, error: "cluster_not_found" }, { status: 404 });
    }
    const existingItem = existingCluster.items.find((item) => item.id === itemId);
    if (!existingItem) {
      return NextResponse.json({ ok: false as const, error: "cluster_item_not_found" }, { status: 404 });
    }

    // Acceptance is explicit because copied follow graphs are staged prospect maps.
    // This keeps hand-curated network adjacency from leaking into broader lead sets
    // until an operator intentionally promotes a specific handle.
    const cluster = await updateManualIgClusterItemStatus({
      clusterId,
      itemId,
      status: "accepted",
    });
    const acceptedItem = cluster.items.find((item) => item.id === itemId);
    if (!acceptedItem) throw new Error("accepted_item_missing");
    const acceptedResult = await appendManualIgAcceptedRecord({
      acceptedAt: acceptedItem.acceptedAt || new Date().toISOString(),
      clusterId: cluster.clusterId,
      originHandle: cluster.sourceMeta.originHandle,
      handle: acceptedItem.handle,
      displayName: acceptedItem.displayName,
      categoryGuess: acceptedItem.categoryGuess,
      confidence: acceptedItem.confidence,
      source: "manual_ig_cluster",
      evidenceType: "social_seed",
      platform: "instagram",
      captureMethod: "copy_paste",
      market: cluster.sourceMeta.market,
      tags: cluster.sourceMeta.tags,
    });

    return NextResponse.json({
      ok: true as const,
      cluster,
      acceptedRecord: acceptedResult.acceptedRecord,
      inserted: acceptedResult.inserted,
      alreadyAccepted: !acceptedResult.inserted || existingItem.status === "accepted",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "cluster_not_found" ? 404 : message === "cluster_item_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
