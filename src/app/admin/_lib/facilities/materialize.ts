import fs from "fs";
import path from "path";
import type { FacilitySeedRow } from "./normalize";
import { addressKeyFromParts, normSpace, slugify } from "./normalize";
import { dataRootAbs } from "../../../api/admin/_lib/paths";

export type Facility = {
  facilityId: string;
  addressKey: string;
  brand: string;
  locationLabel?: string;
  displayName: string;
  category: string;
  source?: string;
  phone?: string;
  website?: string;
  types?: string[];
  updatedAt: string;
};

export type FacilityIndexDoc = {
  ok: true;
  kind: "facility_index";
  version: "v1";
  source: { seedsDir: string };
  counts: { facilities: number; seedFiles: number };
  facilities: Facility[];
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function facilitiesSeedsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "facilities", "seeds");
}

function facilitiesDerivedDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "facilities", "derived");
}

function facilitiesReceiptsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "facilities", "receipts");
}

export function listSeedFilesAbs(): string[] {
  const dir = facilitiesSeedsDirAbs();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f));
}

export function readJsonlAbs(fileAbs: string): FacilitySeedRow[] {
  const raw = fs.readFileSync(fileAbs, "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

export function buildFacilityFromSeed(r: FacilitySeedRow): Facility | null {
  const brand = normSpace(r.brand);
  if (!brand) return null;

  if (!r.address1 || !r.city || !r.state || !r.zip) return null;

  const ak = addressKeyFromParts(r);
  const label = normSpace(r.locationLabel ?? "");
  const displayName = label ? `${brand} - ${label}` : brand;

  const cat = normSpace(r.category ?? "");
  const category =
    cat || (brand.toLowerCase().includes("great clips") ? "SALON_CORP_CHAIN" : "FACILITY");

  const facilityId = `${slugify(brand)}__${slugify(ak)}`;

  return {
    facilityId,
    addressKey: ak,
    brand,
    locationLabel: label || undefined,
    displayName,
    category,
    source: r.source,
    phone: r.phone,
    website: r.website,
    types: r.types,
    updatedAt: nowIso(),
  };
}

export function materializeFacilityIndex(): FacilityIndexDoc {
  const files = listSeedFilesAbs();
  const byAk = new Map<string, Facility>();

  for (const f of files) {
    const rows = readJsonlAbs(f);
    for (const r of rows) {
      const fac = buildFacilityFromSeed(r);
      if (!fac) continue;
      // last write wins by addressKey
      byAk.set(fac.addressKey, fac);
    }
  }

  const facilities = Array.from(byAk.values()).sort((a, b) => a.addressKey.localeCompare(b.addressKey));
  const doc: FacilityIndexDoc = {
    ok: true,
    kind: "facility_index",
    version: "v1",
    source: { seedsDir: "data/co/dora/denver_metro/facilities/seeds" },
    counts: { facilities: facilities.length, seedFiles: files.length },
    facilities,
    updatedAt: nowIso(),
  };

  // write out
  const outAbs = path.join(facilitiesDerivedDirAbs(), "facility_index.v1.json");
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify(doc, null, 2), "utf8");

  return doc;
}

export function appendSeedsIdempotent(opts: { seedFileName: string; rows: FacilitySeedRow[] }) {
  const seedsDir = facilitiesSeedsDirAbs();
  fs.mkdirSync(seedsDir, { recursive: true });

  const seedFileAbs = path.join(seedsDir, opts.seedFileName);

  // load all existing addressKeys across all seed files for true idempotency
  const existingAk = new Set<string>();
  for (const f of listSeedFilesAbs()) {
    try {
      for (const r of readJsonlAbs(f)) {
        if (r?.address1 && r?.city && r?.state && r?.zip) {
          existingAk.add(addressKeyFromParts(r));
        }
      }
    } catch {
      // ignore broken file
    }
  }

  let added = 0;
  let skippedExisting = 0;
  const linesToAppend: string[] = [];

  for (const r of opts.rows) {
    const fac = buildFacilityFromSeed(r);
    if (!fac) continue;

    if (existingAk.has(fac.addressKey)) {
      skippedExisting += 1;
      continue;
    }

    // append raw seed row (not derived facility), but normalize minimal required fields
    const seedRow: FacilitySeedRow = {
      brand: normSpace(r.brand),
      locationLabel: normSpace(r.locationLabel ?? "") || undefined,
      address1: normSpace(r.address1),
      address2: normSpace(r.address2 ?? "") || undefined,
      city: normSpace(r.city),
      state: normSpace(r.state),
      zip: normSpace(r.zip),
      category: normSpace(r.category ?? "") || undefined,
      source: normSpace(r.source ?? "") || undefined,
      phone: normSpace(r.phone ?? "") || undefined,
      website: normSpace(r.website ?? "") || undefined,
      types: Array.isArray(r.types) ? r.types : undefined,
    };

    linesToAppend.push(JSON.stringify(seedRow));
    existingAk.add(fac.addressKey);
    added += 1;
  }

  if (linesToAppend.length) {
    const prefix =
      fs.existsSync(seedFileAbs) && fs.readFileSync(seedFileAbs, "utf8").trim().length ? "\n" : "";
    fs.appendFileSync(seedFileAbs, prefix + linesToAppend.join("\n"), "utf8");
  }

  return { seedFileAbs, added, skippedExisting };
}

export function writeReceipt(payload: unknown) {
  const dir = facilitiesReceiptsDirAbs();
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outAbs = path.join(dir, `import_${ts}.json`);
  fs.writeFileSync(outAbs, JSON.stringify(payload, null, 2), "utf8");
  return outAbs;
}
