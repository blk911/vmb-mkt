import { NextResponse } from "next/server";
import { findSocialResultByQueueItemId } from "@/lib/source-intake/phase2-store";
import { resolveSocialQueueItem } from "@/lib/source-intake/social-resolver";
import type { ValidationReviewOutcome } from "@/lib/source-intake/phase2-types";

export const runtime = "nodejs";

type ResolveBody = {
  action?: ValidationReviewOutcome;
  mergeTargetId?: string;
};

function isAction(value: unknown): value is ValidationReviewOutcome {
  return value === "approved" || value === "merged" || value === "rejected";
}

export async function POST(req: Request, ctx: { params: Promise<{ queueItemId: string }> }) {
  try {
    const body = (await req.json().catch(() => ({}))) as ResolveBody;
    const { queueItemId } = await ctx.params;
    const id = decodeURIComponent(queueItemId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "missing_queueItemId" }, { status: 400 });
    }
    if (body.action !== undefined && !isAction(body.action)) {
      return NextResponse.json({ ok: false as const, error: "invalid_action" }, { status: 400 });
    }
    if (body.action === "merged" && !body.mergeTargetId?.trim()) {
      return NextResponse.json({ ok: false as const, error: "mergeTargetId_required" }, { status: 400 });
    }

    const existing = await findSocialResultByQueueItemId(id);
    if (existing && !body.action) {
      return NextResponse.json({ ok: true as const, result: existing });
    }

    const result = await resolveSocialQueueItem(id, {
      action: body.action,
      mergeTargetId: body.mergeTargetId,
    });
    return NextResponse.json({ ok: true as const, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
