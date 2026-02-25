import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

export async function GET() {
  try {
    const abs = path.join(doraDenverDerivedAbs(), "tech_ids_by_address.json");
    const s = await fs.readFile(abs, "utf8");
    return new NextResponse(s, {
      headers: {
        "content-type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "file not found" },
      { status: 404 }
    );
  }
}
