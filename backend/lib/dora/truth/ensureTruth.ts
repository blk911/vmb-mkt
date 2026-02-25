import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs, doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import { buildCityTruthFromVMB } from "@/backend/lib/dora/truth/buildCityTruthFromVMB";

async function writeJsonAtomic(abs: string, obj: any) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, abs);
}

function toRows(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  if (Array.isArray(j.data)) return j.data;
  if (Array.isArray(j.items)) return j.items;
  return [];
}

export async function ensureTruthRollups() {
  const tablesDir = doraDenverTablesAbs();
  const derivedDir = doraDenverDerivedAbs();

  // ✅ VMB-normalized inputs (these exist in your tables dir)
  const addressAbs = path.join(tablesDir, "vmb_address_rollup.json");
  const licenseAbs = path.join(tablesDir, "vmb_licensees_attached.json");
  const candAbs = path.join(tablesDir, "vmb_attach_candidates.json");

  // Hard guards
  for (const p of [addressAbs, licenseAbs]) {
    try { await fs.stat(p); } catch {
      throw new Error(`Missing required VMB artifact: ${p}`);
    }
  }

  const addressJson = JSON.parse(await fs.readFile(addressAbs, "utf8"));
  const licenseJson = JSON.parse(await fs.readFile(licenseAbs, "utf8"));
  const candJson = await fs.readFile(candAbs, "utf8").then(s => JSON.parse(s)).catch(() => null);

  const addressRows = toRows(addressJson);
  const licenseRows = toRows(licenseJson);
  const candRows = toRows(candJson);

  if (addressRows.length === 0) throw new Error("vmb_address_rollup.json parsed to 0 rows");
  if (licenseRows.length === 0) throw new Error("vmb_licensees_attached.json parsed to 0 rows");

  const cityRows = buildCityTruthFromVMB({ addressRows, licenseRows, candRows });

  const outCity = path.join(derivedDir, "city_truth_rollup.json");
  await writeJsonAtomic(outCity, { ok: true, updatedAt: new Date().toISOString(), rows: cityRows });

  return {
    ok: true,
    inputs: {
      addressAbs,
      licenseAbs,
      candAbs,
      addressRows: addressRows.length,
      licenseRows: licenseRows.length,
      candRows: candRows.length,
    },
    outputs: {
      outCity,
      cityRows: cityRows.length,
    },
  };
}
