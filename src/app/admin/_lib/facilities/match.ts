import fs from "fs";
import path from "path";
import type { FacilitySeedRow } from "./normalize";
import { addressKeyFromParts, normSpace } from "./normalize";
import { dataRootAbs } from "../../../api/admin/_lib/paths";
import { buildFacilityFromSeed, listSeedFilesAbs, readJsonlAbs } from "./materialize";

export type PreviewRow = {
  input: FacilitySeedRow;
  addressKey?: string;
  ok: boolean;
  reason?: string;
  matched?: {
    addressKey: string;
    displayName: string;
    brand: string;
    category: string;
    facilityId?: string;
    website?: string;
    phone?: string;
  };
};

function facilityIndexAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "facilities",
    "derived",
    "facility_index.v1.json"
  );
}

function loadKnownFacilitiesByAk() {
  const byAk = new Map<string, unknown>();

  // A) from facility_index if present
  const idx = facilityIndexAbs();
  if (fs.existsSync(idx)) {
    try {
      const doc = JSON.parse(fs.readFileSync(idx, "utf8"));
      const facilities = Array.isArray(doc?.facilities) ? doc.facilities : [];
      for (const f of facilities) {
        if (f?.addressKey) byAk.set(String(f.addressKey).trim(), f);
      }
    } catch {
      // ignore
    }
  }

  // B) from seeds too (so preview works before first materialize)
  for (const f of listSeedFilesAbs()) {
    try {
      for (const r of readJsonlAbs(f)) {
        const fac = buildFacilityFromSeed(r);
        if (fac?.addressKey) byAk.set(fac.addressKey, fac);
      }
    } catch {
      // ignore
    }
  }

  return byAk;
}

export function previewFacilities(rows: FacilitySeedRow[]) {
  const knownByAk = loadKnownFacilitiesByAk();

  const out: PreviewRow[] = [];
  for (const r of rows) {
    const brand = normSpace(r.brand);
    const hasMin = brand && r.address1 && r.city && r.state && r.zip;

    if (!hasMin) {
      out.push({
        input: r,
        ok: false,
        reason: "Missing required fields (brand,address1,city,state,zip)",
      });
      continue;
    }

    const ak = addressKeyFromParts(r);
    const known: any = knownByAk.get(ak);

    if (known) {
      out.push({
        input: r,
        addressKey: ak,
        ok: true,
        matched: {
          addressKey: ak,
          displayName: known.displayName ?? known.brand ?? "Facility",
          brand: known.brand ?? brand,
          category: known.category ?? r.category ?? "FACILITY",
          facilityId: known.facilityId,
          website: known.website,
          phone: known.phone,
        },
      });
    } else {
      out.push({ input: r, addressKey: ak, ok: true });
    }
  }

  const matched = out.filter((r) => !!r.matched);
  const notFound = out.filter((r) => r.ok && !r.matched && r.addressKey);
  const invalid = out.filter((r) => !r.ok);

  return {
    ok: true,
    counts: {
      input: rows.length,
      matched: matched.length,
      notFound: notFound.length,
      invalid: invalid.length,
    },
    matched,
    notFound,
    invalid,
  };
}
