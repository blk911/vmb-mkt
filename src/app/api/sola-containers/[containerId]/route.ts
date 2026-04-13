import { NextResponse } from "next/server";
import { getSolaContainerById, updateSolaContainer } from "@/lib/sola-containers/store";
import type { SolaContainerStatus } from "@/lib/sola-containers/types";

export const runtime = "nodejs";

type ContainerPatchBody = {
  locationPageUrl?: string;
  directoryPageUrl?: string;
  status?: string;
  notes?: string;
};

function isSolaContainerStatus(value: unknown): value is SolaContainerStatus {
  return (
    value === "seeded" ||
    value === "resolved" ||
    value === "tenant_pull_ready" ||
    value === "tenant_pull_in_progress" ||
    value === "tenant_pull_complete"
  );
}

// Parent URL updates are intentionally explicit so official location surfaces
// can be curated at the container level before broader extraction begins.
export async function PATCH(req: Request, ctx: { params: Promise<{ containerId: string }> }) {
  let body: ContainerPatchBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as ContainerPatchBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  try {
    const { containerId } = await ctx.params;
    const id = decodeURIComponent(containerId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "containerId_required" }, { status: 400 });
    }

    const existing = await getSolaContainerById(id);
    if (!existing) {
      return NextResponse.json({ ok: false as const, error: "container_not_found" }, { status: 404 });
    }

    if (body.locationPageUrl !== undefined && typeof body.locationPageUrl !== "string") {
      return NextResponse.json({ ok: false as const, error: "invalid_locationPageUrl" }, { status: 400 });
    }
    if (body.directoryPageUrl !== undefined && typeof body.directoryPageUrl !== "string") {
      return NextResponse.json({ ok: false as const, error: "invalid_directoryPageUrl" }, { status: 400 });
    }
    if (body.notes !== undefined && typeof body.notes !== "string") {
      return NextResponse.json({ ok: false as const, error: "invalid_notes" }, { status: 400 });
    }
    if (body.status !== undefined && !isSolaContainerStatus(body.status)) {
      return NextResponse.json({ ok: false as const, error: "invalid_status" }, { status: 400 });
    }

    const container = await updateSolaContainer(id, {
      locationPageUrl: body.locationPageUrl,
      directoryPageUrl: body.directoryPageUrl,
      status: body.status,
      notes: body.notes,
    });

    return NextResponse.json({ ok: true as const, container });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
