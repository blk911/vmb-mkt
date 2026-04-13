import { NextResponse } from "next/server";
import {
  getSolaContainerById,
  listSolaContainers,
  seedDenverSolaContainers,
  updateSolaContainerStatus,
} from "@/lib/sola-containers/store";

export const runtime = "nodejs";

type SolaContainersActionBody = {
  action?: string;
  containerId?: string;
};

export async function GET() {
  try {
    const containers = await listSolaContainers();
    return NextResponse.json(
      { ok: true as const, containers },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: SolaContainersActionBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as SolaContainersActionBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.action === "seed_denver") {
      const result = await seedDenverSolaContainers();
      return NextResponse.json({
        ok: true as const,
        total: result.total,
        inserted: result.inserted,
        skipped: result.skipped,
        containers: result.containers,
      });
    }

    if (body.action === "mark_ready") {
      const containerId = typeof body.containerId === "string" ? body.containerId.trim() : "";
      if (!containerId) {
        return NextResponse.json({ ok: false as const, error: "containerId_required" }, { status: 400 });
      }
      const existing = await getSolaContainerById(containerId);
      if (!existing) {
        return NextResponse.json({ ok: false as const, error: "container_not_found" }, { status: 404 });
      }
      const container = await updateSolaContainerStatus(containerId, "tenant_pull_ready");
      return NextResponse.json({ ok: true as const, container });
    }

    return NextResponse.json({ ok: false as const, error: "unsupported_action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
