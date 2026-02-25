import { NextResponse } from "next/server";
import { createTargetList } from "@/app/admin/_lib/targets/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, scope, savedQuery } = body;

    if (!name || !scope) {
      return NextResponse.json(
        { ok: false, error: "name and scope required" },
        { status: 400 }
      );
    }

    if (scope !== "facility" && scope !== "tech") {
      return NextResponse.json(
        { ok: false, error: "scope must be 'facility' or 'tech'" },
        { status: 400 }
      );
    }

    const list = await createTargetList({ name, scope, savedQuery });
    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
