import { NextResponse } from "next/server";
import { readTargetList, addItems, removeItems } from "@/app/admin/_lib/targets/store";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";

export async function POST(
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

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "items must be an array" }, { status: 400 });
    }

    const list = await addItems(listId, items);
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

    const body = await req.json();
    const { refIds } = body;

    if (!Array.isArray(refIds)) {
      return NextResponse.json({ ok: false, error: "refIds must be an array" }, { status: 400 });
    }

    const list = await removeItems(listId, refIds);
    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
