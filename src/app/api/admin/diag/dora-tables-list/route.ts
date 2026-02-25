import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { doraDenverTablesAbs } from "@/backend/lib/paths/data-root";

export async function GET() {
  const dir = doraDenverTablesAbs();
  const names = await fs.readdir(dir).catch(() => []);
  const json = names.filter(n => n.toLowerCase().endsWith(".json")).sort();
  return NextResponse.json({ ok: true, dir, json });
}
