import { NextResponse } from "next/server";
import { deleteTargetList, readTargetList, updateListMeta } from "@/app/admin/_lib/targets/store";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";

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
    const { name, notes, savedQuery } = body;

    const list = await updateListMeta(listId, { name, notes, savedQuery });
    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: { listId: string } }
) {
  try {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const listId = decodeURIComponent(ctx.params.listId || "").trim();
    if (!listId) {
      return NextResponse.json({ ok: false, error: "missing listId" }, { status: 400 });
    }

    await deleteTargetList(listId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
