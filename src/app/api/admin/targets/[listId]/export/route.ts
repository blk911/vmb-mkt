import { NextResponse } from "next/server";
import { readTargetList } from "@/app/admin/_lib/targets/store";
import { toCsv, toJson } from "../../../../../admin/_lib/targets/export";

export async function GET(
  req: Request,
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

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    if (format === "csv") {
      const csv = toCsv(list);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="targets_${listId}.csv"`,
        },
      });
    } else {
      const json = toJson(list);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="targets_${listId}.json"`,
        },
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
