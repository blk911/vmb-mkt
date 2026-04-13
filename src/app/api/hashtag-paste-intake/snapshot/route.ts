import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { appendHashtagPasteSnapshot } from "@/lib/hashtag-paste-intake/snapshot-store";
import type { HashtagPasteIntakeResult, HashtagPasteSnapshot } from "@/lib/hashtag-paste-intake/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { result?: HashtagPasteIntakeResult };
  try {
    body = (await req.json()) as { result?: HashtagPasteIntakeResult };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (!body.result) {
    return NextResponse.json({ ok: false as const, error: "result_required" }, { status: 400 });
  }

  try {
    const createdAt = new Date().toISOString();
    const snapshot: HashtagPasteSnapshot = {
      id: `hpi_snapshot_${crypto.createHash("md5").update(`${createdAt}|${body.result.request.rawText}`).digest("hex").slice(0, 12)}`,
      createdAt,
      result: body.result,
    };
    await appendHashtagPasteSnapshot(snapshot);
    return NextResponse.json({ ok: true as const, snapshotId: snapshot.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "snapshot_save_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
