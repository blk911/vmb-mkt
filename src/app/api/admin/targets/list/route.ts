import { NextResponse } from "next/server";
import { listTargetLists } from "@/app/admin/_lib/targets/store";

export async function GET() {
  try {
    const index = await listTargetLists();
    return NextResponse.json(index, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
