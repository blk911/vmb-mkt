import { NextResponse } from "next/server";
import { findDoraResultByQueueItemId, listDoraQueue } from "@/lib/source-intake/phase2-store";

export const runtime = "nodejs";

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "").trim();
    const limit = clampInt(url.searchParams.get("limit"), 100, 1, 500);
    const queue = await listDoraQueue();
    const filtered = status ? queue.filter((row) => row.status === status) : queue;
    const rows = await Promise.all(
      filtered.slice(0, limit).map(async (item) => ({
        item,
        result: await findDoraResultByQueueItemId(item.id),
      }))
    );
    return NextResponse.json({ ok: true as const, rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
