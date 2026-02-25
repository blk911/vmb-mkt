import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const p = path.join(
    process.cwd(),
    "data/co/dora/denver_metro/dora/derived/dora_2to7_active.v1.json"
  );

  if (!fs.existsSync(p)) {
    return NextResponse.json({ ok: false, error: "missing_dataset" }, { status: 404 });
  }

  const j = JSON.parse(fs.readFileSync(p, "utf8"));

  return NextResponse.json({
    ok: true,
    version: j.version,
    count: j.rows?.length || 0,
    rows: j.rows || [],
  });
}
