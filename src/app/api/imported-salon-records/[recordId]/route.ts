import { NextResponse } from "next/server";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";
import {
  getImportedSalonRecordById,
  updateImportedSalonRecordDecisionStatus,
  updateImportedSalonRecordStatus,
} from "@/lib/imported-salon-records/store";
import type { ImportedSalonRecordStatus } from "@/lib/imported-salon-records/types";

export const runtime = "nodejs";

function isRecordStatus(value: unknown): value is ImportedSalonRecordStatus {
  return value === "active" || value === "archived";
}

function isDecisionStatus(value: unknown): value is ImportDecisionStatus {
  return value === "unresolved" || value === "standalone" || value === "likely_duplicate" || value === "merge_candidate";
}

export async function GET(_req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const id = decodeURIComponent(recordId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "recordId_required" }, { status: 400 });
    }
    const record = await getImportedSalonRecordById(id);
    if (!record) {
      return NextResponse.json({ ok: false as const, error: "record_not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true as const, record },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  let body: { status?: string; decisionStatus?: string };
  try {
    body = (await req.json()) as { status?: string; decisionStatus?: string };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { recordId } = await ctx.params;
    const id = decodeURIComponent(recordId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "recordId_required" }, { status: 400 });
    }
    const providedModes = [body.status !== undefined, body.decisionStatus !== undefined].filter(Boolean).length;
    if (providedModes > 1) {
      return NextResponse.json({ ok: false as const, error: "patch_one_mode_only" }, { status: 400 });
    }
    let record;
    if (body.status !== undefined) {
      if (!isRecordStatus(body.status)) {
        return NextResponse.json({ ok: false as const, error: "invalid_status" }, { status: 400 });
      }
      record = await updateImportedSalonRecordStatus(id, body.status);
    } else if (body.decisionStatus !== undefined) {
      if (!isDecisionStatus(body.decisionStatus)) {
        return NextResponse.json({ ok: false as const, error: "invalid_decision_status" }, { status: 400 });
      }
      record = await updateImportedSalonRecordDecisionStatus(id, body.decisionStatus);
    } else {
      return NextResponse.json({ ok: false as const, error: "patch_payload_required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true as const, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "record_update_failed";
    const status = message === "record_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
