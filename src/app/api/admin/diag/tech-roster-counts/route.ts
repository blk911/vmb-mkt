// PURPOSE: confirm tech counts > 0 and addresses are populated.

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

export async function GET() {
  try {
    const dir = doraDenverDerivedAbs();

    const techById = JSON.parse(
      await fs.readFile(path.join(dir, "tech_by_id.json"), "utf8")
    );

    const byAddr = JSON.parse(
      await fs.readFile(path.join(dir, "tech_ids_by_address.json"), "utf8")
    );

    return NextResponse.json({
      ok: true,
      techCount: Object.keys(techById.techById || {}).length,
      addressCount: Object.keys(byAddr.techIdsByAddress || {}).length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed to read files" },
      { status: 500 }
    );
  }
}
