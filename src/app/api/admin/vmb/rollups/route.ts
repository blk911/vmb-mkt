import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveDoraTableAbs } from "@/backend/lib/paths/data-root";

/**
 * GET /api/admin/vmb/rollups
 *
 * Returns:
 *  { ok: true, rows: RollupRow[] }
 *
 * Source of truth:
 *  - env VMB_ROLLUPS_JSON_REL (repo-relative path), OR
 *  - canonical: resolveDoraTableAbs("address_rollup")
 *
 * NOTE: this is Patch 1.x – city-level rollups, large file but still OK.
 */
export async function GET() {
  try {
    // Prefer env override so you can point at any dataset without code changes.
    let abs: string;
    if (process.env.VMB_ROLLUPS_JSON_REL?.trim()) {
      const rel = process.env.VMB_ROLLUPS_JSON_REL.trim();
      abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    } else {
      // Use canonical resolver (tries address_rollup.json and vmb_address_rollup.json)
      abs = resolveDoraTableAbs("address_rollup");
    }

    const txt = fs.readFileSync(abs, "utf8");
    const rows = JSON.parse(txt);

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { ok: false, error: "rollups json is not an array", abs },
        { status: 500 }
      );
    }

    // Disable caching so you see changes immediately after materialize.
    return NextResponse.json(
      { ok: true, abs, rows },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
