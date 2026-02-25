import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs } from "@/backend/lib/paths/data-root";

function toRows(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  return [];
}

export async function GET() {
  try {
    const tablesDir = doraDenverTablesAbs();
    const licAbs = path.join(tablesDir, "vmb_licensees_attached.json");
    const licJson = JSON.parse(await fs.readFile(licAbs, "utf8"));
    const rows = toRows(licJson);

    const sample = rows[0] || null;
    return NextResponse.json({
      ok: true,
      rowsTotal: rows.length,
      sampleKeys: sample ? Object.keys(sample).sort() : [],
      sample,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
