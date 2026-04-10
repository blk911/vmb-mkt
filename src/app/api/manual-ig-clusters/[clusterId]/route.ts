import { NextResponse } from "next/server";
import { getManualIgClusterById } from "@/lib/manual-ig-clusters/store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ clusterId: string }> }) {
  try {
    const { clusterId } = await ctx.params;
    if (!clusterId) {
      return NextResponse.json({ ok: false as const, error: "clusterId_required" }, { status: 400 });
    }
    const cluster = await getManualIgClusterById(clusterId);
    if (!cluster) {
      return NextResponse.json({ ok: false as const, error: "cluster_not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true as const, cluster },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
