import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs, doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

async function exists(abs: string) {
  try { await fs.stat(abs); return true; } catch { return false; }
}

async function stat(abs: string) {
  try {
    const s = await fs.stat(abs);
    return { exists: true, size: s.size, mtime: s.mtime.toISOString() };
  } catch {
    return { exists: false };
  }
}

function toRows(j: any): any[] {
  // Robust "best effort" shape normalization
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  if (Array.isArray(j.data)) return j.data;
  if (Array.isArray(j.items)) return j.items;
  // Sometimes it's { ok:true, techById:{...} } etc
  return [];
}

async function readJsonIfExists(abs: string) {
  if (!(await exists(abs))) return null;
  const s = await fs.readFile(abs, "utf8");
  try { return JSON.parse(s); } catch { return { parseError: true }; }
}

export async function GET() {
  const tablesDir = doraDenverTablesAbs();
  const derivedDir = doraDenverDerivedAbs();

  const candidates = {
    facilities: [
      path.join(tablesDir, "facilities.json"),
      path.join(tablesDir, "vmb_facilities.json"),
    ],
    licensees: [
      path.join(tablesDir, "licensees.json"),
      path.join(tablesDir, "vmb_licensees.json"),
    ],
    cityTruth: path.join(derivedDir, "city_truth_rollup.json"),
    addrTruth: path.join(derivedDir, "address_truth_rollup.json"),
  };

  // Find which input actually exists
  let facilitiesAbs: string | null = null;
  for (const p of candidates.facilities) { if (await exists(p)) { facilitiesAbs = p; break; } }

  let licenseesAbs: string | null = null;
  for (const p of candidates.licensees) { if (await exists(p)) { licenseesAbs = p; break; } }

  const facilitiesJson = facilitiesAbs ? await readJsonIfExists(facilitiesAbs) : null;
  const licenseesJson = licenseesAbs ? await readJsonIfExists(licenseesAbs) : null;

  const cityTruthJson = await readJsonIfExists(candidates.cityTruth);
  const addrTruthJson = await readJsonIfExists(candidates.addrTruth);

  const facilitiesRows = toRows(facilitiesJson);
  const licenseesRows = toRows(licenseesJson);
  const cityTruthRows = toRows(cityTruthJson?.rows ? cityTruthJson : cityTruthJson);
  const addrTruthRows = toRows(addrTruthJson?.rows ? addrTruthJson : addrTruthJson);

  return NextResponse.json({
    ok: true,
    resolved: {
      tablesDir,
      derivedDir,
      facilitiesAbs,
      licenseesAbs,
    },
    stats: {
      facilitiesAbs: facilitiesAbs ? await stat(facilitiesAbs) : { exists: false },
      licenseesAbs: licenseesAbs ? await stat(licenseesAbs) : { exists: false },
      cityTruth: await stat(candidates.cityTruth),
      addrTruth: await stat(candidates.addrTruth),
    },
    counts: {
      facilitiesRows: facilitiesRows.length,
      licenseesRows: licenseesRows.length,
      cityTruthRows: Array.isArray(cityTruthJson?.rows) ? cityTruthJson.rows.length : (Array.isArray(cityTruthJson) ? cityTruthJson.length : 0),
      addrTruthRows: Array.isArray(addrTruthJson?.rows) ? addrTruthJson.rows.length : (Array.isArray(addrTruthJson) ? addrTruthJson.length : 0),
    },
    samples: {
      facilitiesKeys: facilitiesRows[0] ? Object.keys(facilitiesRows[0]).slice(0, 25) : [],
      licenseesKeys: licenseesRows[0] ? Object.keys(licenseesRows[0]).slice(0, 25) : [],
      cityTruthFirst: (cityTruthJson?.rows?.[0]) || null,
    }
  });
}
