import { NextResponse } from "next/server";
import {
  appendSolaTenantRecords,
  createSolaTenantId,
  getSolaContainerById,
  listSolaTenantsByContainerId,
  updateSolaContainerStatus,
} from "@/lib/sola-containers/store";
import { guessSolaTenantCategory, parseSolaTenantText } from "@/lib/sola-containers/tenant-parser";
import type { SolaTenantRecord } from "@/lib/sola-containers/types";

export const runtime = "nodejs";

type TenantImportBody = {
  mode?: string;
  sourceType?: SolaTenantRecord["sourceType"];
  pastedText?: string;
};

export async function GET(_req: Request, ctx: { params: Promise<{ containerId: string }> }) {
  try {
    const { containerId } = await ctx.params;
    const id = decodeURIComponent(containerId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "containerId_required" }, { status: 400 });
    }
    const container = await getSolaContainerById(id);
    if (!container) {
      return NextResponse.json({ ok: false as const, error: "container_not_found" }, { status: 404 });
    }
    const tenants = await listSolaTenantsByContainerId(id);
    return NextResponse.json(
      { ok: true as const, container, tenants },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ containerId: string }> }) {
  let body: TenantImportBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as TenantImportBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { containerId } = await ctx.params;
    const id = decodeURIComponent(containerId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "containerId_required" }, { status: 400 });
    }
    const container = await getSolaContainerById(id);
    if (!container) {
      return NextResponse.json({ ok: false as const, error: "container_not_found" }, { status: 404 });
    }

    if (body.mode !== "manual_text") {
      return NextResponse.json({ ok: false as const, error: "unsupported_mode" }, { status: 400 });
    }
    if (body.sourceType && body.sourceType !== "manual_extract" && body.sourceType !== "unknown") {
      return NextResponse.json({ ok: false as const, error: "unsupported_sourceType" }, { status: 400 });
    }
    const pastedText = typeof body.pastedText === "string" ? body.pastedText : "";
    if (!pastedText.trim()) {
      return NextResponse.json({ ok: false as const, error: "pastedText_required" }, { status: 400 });
    }

    const parsed = parseSolaTenantText(pastedText);
    if (!parsed.length) {
      return NextResponse.json({ ok: false as const, error: "no_tenants_parsed" }, { status: 400 });
    }

    await updateSolaContainerStatus(id, "tenant_pull_in_progress");

    const now = new Date().toISOString();
    const incoming: SolaTenantRecord[] = parsed.map((row) => ({
      id: createSolaTenantId(id, row.tenantName, row.suite),
      containerId: id,
      containerName: container.name,
      tenantName: row.tenantName,
      categoryGuess: guessSolaTenantCategory(
        [row.tenantName, row.websiteUrl, row.instagramUrl, row.bookingUrl].filter(Boolean).join(" ")
      ),
      suite: row.suite,
      phone: row.phone,
      websiteUrl: row.websiteUrl,
      instagramUrl: row.instagramUrl,
      bookingUrl: row.bookingUrl,
      sourceType: body.sourceType || "manual_extract",
      evidenceLabel: `manual tenant import for ${container.name}`,
      status: "extracted",
      createdAt: now,
      updatedAt: now,
    }));

    const result = await appendSolaTenantRecords(incoming);
    const updatedContainer = await updateSolaContainerStatus(id, "tenant_pull_complete");
    const tenants = result.tenants.filter((row) => row.containerId === id);

    return NextResponse.json({
      ok: true as const,
      container: updatedContainer,
      tenants,
      inserted: result.inserted,
      skipped: result.skipped,
      totalTenants: tenants.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
