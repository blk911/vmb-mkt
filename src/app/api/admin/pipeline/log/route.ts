import { NextResponse } from "next/server";
import { appendAdminAction } from "@/lib/admin/pipeline/logging";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      entityType?: string;
      entityId?: string;
      result?: string;
      details?: Record<string, unknown>;
    };

    if (!body.action || !body.entityType || !body.entityId || !body.result) {
      return NextResponse.json({ ok: false as const, error: "missing_log_fields" }, { status: 400 });
    }

    const entry = await appendAdminAction({
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      result: body.result,
      details: body.details,
    });

    return NextResponse.json({ ok: true as const, entry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
