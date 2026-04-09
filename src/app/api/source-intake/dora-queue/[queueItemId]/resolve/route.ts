import { NextResponse } from "next/server";
import { findDoraResultByQueueItemId } from "@/lib/source-intake/phase2-store";
import { resolveDoraQueueItem } from "@/lib/source-intake/dora-resolver";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ queueItemId: string }> }) {
  try {
    const { queueItemId } = await ctx.params;
    const id = decodeURIComponent(queueItemId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "missing_queueItemId" }, { status: 400 });
    }

    const existing = await findDoraResultByQueueItemId(id);
    if (existing) {
      return NextResponse.json({ ok: true as const, result: existing });
    }

    const result = await resolveDoraQueueItem(id);
    return NextResponse.json({ ok: true as const, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
