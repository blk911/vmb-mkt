import { NextResponse } from "next/server";
import fs from "node:fs";
import { dataRootAbs, doraDenverTablesAbs, resolveDoraTableAbs } from "@/backend/lib/paths/data-root";

export async function GET() {
  let licensees: string | null = null;
  let facilities: string | null = null;

  try { licensees = resolveDoraTableAbs("licensees"); } catch {}
  try { facilities = resolveDoraTableAbs("facilities"); } catch {}

  return NextResponse.json({
    ok: true,
    dataRootAbs: dataRootAbs(),
    tablesDirAbs: doraDenverTablesAbs(),
    existsTablesDir: fs.existsSync(doraDenverTablesAbs()),
    resolved: { licensees, facilities },
  });
}
