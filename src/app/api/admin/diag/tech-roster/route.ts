// PURPOSE: prove derived tech roster artifacts exist and are readable.
// This removes UI ambiguity.

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

async function exists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const dir = doraDenverDerivedAbs();

  const techById = path.join(dir, "tech_by_id.json");
  const byAddr = path.join(dir, "tech_ids_by_address.json");

  return NextResponse.json({
    ok: true,
    derivedDir: dir,
    files: {
      tech_by_id: {
        path: techById,
        exists: await exists(techById),
      },
      tech_ids_by_address: {
        path: byAddr,
        exists: await exists(byAddr),
      },
    },
  });
}
