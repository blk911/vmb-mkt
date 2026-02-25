import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import { ensureTruthRollups } from "@/backend/lib/dora/truth/ensureTruth";

export async function GET() {
  try {
    await ensureTruthRollups();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
  try {
    const abs = path.join(doraDenverDerivedAbs(), "address_truth_rollup.json");
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
