import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs, doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import { buildAddressTruth } from "@/backend/lib/dora/truth/buildAddressTruth";
import { buildCityTruth } from "@/backend/lib/dora/truth/buildCityTruth";

// atomic writer
async function writeJsonAtomic(abs: string, obj: any) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, abs);
}

async function readAny(absCandidates: string[]) {
  for (const p of absCandidates) {
    try {
      const s = await fs.readFile(p, "utf8");
      return { abs: p, json: JSON.parse(s) };
    } catch {}
  }
  throw new Error(`Missing input file. Tried:\n${absCandidates.map((x) => " - " + x).join("\n")}`);
}

export async function POST() {
  try {
    const tablesDir = doraDenverTablesAbs();
    const derivedDir = doraDenverDerivedAbs();

    // NOTE: adjust names once here if your tables are vmb_* prefixed.
    // For PH1, we may need to use rollups instead of facilities if facilities don't exist yet
    const facilitiesFile = await readAny([
      path.join(tablesDir, "facilities.json"),
      path.join(tablesDir, "vmb_facilities.json"),
      path.join(tablesDir, "vmb_address_rollup.json"), // Fallback: use rollups as facilities
    ]);

    const licenseesFile = await readAny([
      path.join(tablesDir, "licensees.json"),
      path.join(tablesDir, "vmb_licensees.json"),
      path.join(tablesDir, "vmb_licensees_attached.json"),
    ]);

    const facilities = Array.isArray(facilitiesFile.json) ? facilitiesFile.json : facilitiesFile.json.rows || [];
    const licensees = Array.isArray(licenseesFile.json) ? licenseesFile.json : licenseesFile.json.rows || [];

    // NOTE: buildAddressTruth requires street-level addresses (street1, city, state, zip).
    // If facilities/rollups only have city-level data (no street addresses), addressRows will be empty.
    // In that case, cityRows will also be empty. You'll need to extract addresses from REG CSV files
    // or use a different materialization path that preserves street addresses.

    // OPTIONAL: if your facility rows already have a franchiseBrandId, map it here.
    const facilityBrandKey = (f: any) => f.franchiseBrandId || f.brandKey || undefined;

    const addressRows = buildAddressTruth({ facilities, licensees, facilityBrandKey });
    const cityRows = buildCityTruth(addressRows);

    const outAddress = path.join(derivedDir, "address_truth_rollup.json");
    const outCity = path.join(derivedDir, "city_truth_rollup.json");

    await writeJsonAtomic(outAddress, { ok: true, updatedAt: new Date().toISOString(), rows: addressRows });
    await writeJsonAtomic(outCity, { ok: true, updatedAt: new Date().toISOString(), rows: cityRows });

    // quick anomaly check: REG==0 and TECH>0 at city level
    const cityAnoms = cityRows.filter((r) => r.regCount === 0 && r.techCount > 0).length;

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      inputs: {
        facilitiesAbs: facilitiesFile.abs,
        licenseesAbs: licenseesFile.abs,
      },
      outputs: { outAddress, outCity },
      counts: {
        facilities: facilities.length,
        licensees: licensees.length,
        addressRows: addressRows.length,
        cityRows: cityRows.length,
        cityAnoms,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error", stack: e?.stack },
      { status: 500 }
    );
  }
}
