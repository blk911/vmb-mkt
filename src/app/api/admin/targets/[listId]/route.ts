import { NextResponse } from "next/server";
import { readTargetList, updateListMeta } from "@/app/admin/_lib/targets/store";
import fs from "node:fs";
import { targetsDirAbs } from "../../_lib/paths";
import path from "node:path";

export async function GET(
  _req: Request,
  ctx: { params: { listId: string } }
) {
  try {
    const listId = decodeURIComponent(ctx.params.listId || "").trim();
    if (!listId) {
      return NextResponse.json({ ok: false, error: "missing listId" }, { status: 400 });
    }

    const list = await readTargetList(listId);
    if (!list) {
      return NextResponse.json({ ok: false, error: "list not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, list }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: { listId: string } }
) {
  try {
    const listId = decodeURIComponent(ctx.params.listId || "").trim();
    if (!listId) {
      return NextResponse.json({ ok: false, error: "missing listId" }, { status: 400 });
    }

    const body = await req.json();
    const { name, savedQuery } = body;

    const list = await updateListMeta(listId, { name, savedQuery });
    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: { listId: string } }
) {
  try {
    const listId = decodeURIComponent(ctx.params.listId || "").trim();
    if (!listId) {
      return NextResponse.json({ ok: false, error: "missing listId" }, { status: 400 });
    }

    // Delete list file
    const listPath = path.join(targetsDirAbs(), `targets_${listId}.json`);
    if (fs.existsSync(listPath)) {
      fs.unlinkSync(listPath);
    }

    // Update index
    const { listTargetLists } = await import("@/app/admin/_lib/targets/store");
    const { writeJsonAtomic } = await import("../../_lib/atomic");
    const index = await listTargetLists();
    index.lists = index.lists.filter((l) => l.id !== listId);
    index.updatedAt = new Date().toISOString();
    const indexPath = path.join(targetsDirAbs(), "targets_index.json");
    await writeJsonAtomic(indexPath, index);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
