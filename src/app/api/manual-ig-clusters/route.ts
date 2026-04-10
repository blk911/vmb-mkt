import { NextResponse } from "next/server";
import { createManualIgCluster, listManualIgClusters } from "@/lib/manual-ig-clusters/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const clusters = await listManualIgClusters();
    return NextResponse.json(
      { ok: true as const, clusters },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const originHandle = typeof body.originHandle === "string" ? body.originHandle.trim() : "";
  const pastedText = typeof body.pastedText === "string" ? body.pastedText : "";
  const market = typeof body.market === "string" ? body.market.trim() : undefined;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
    : undefined;

  if (!originHandle) {
    return NextResponse.json({ ok: false as const, error: "originHandle_required" }, { status: 400 });
  }
  if (!pastedText.trim()) {
    return NextResponse.json({ ok: false as const, error: "pastedText_required" }, { status: 400 });
  }

  try {
    const cluster = await createManualIgCluster({
      originHandle,
      pastedText,
      market,
      tags,
    });
    return NextResponse.json({ ok: true as const, cluster });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status =
      message === "originHandle_required" || message === "pastedText_required" || message === "no_cluster_items_parsed"
        ? 400
        : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
