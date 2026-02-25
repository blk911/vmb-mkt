import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../../api/admin/_lib/paths";
import {
  makeAddressKeyLooseBase,
  makeAddressKeyLooseNorm,
} from "./addressKeyCanon";

type FacilityIndexDoc = {
  ok: boolean;
  facilities: Array<{
    facilityId: string;
    addressKey: string;
    displayName: string;
    brand: string;
    category: string;
    phone?: string;
    website?: string;
    types?: string[];
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

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

function placesMatchedAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched.v1.json"
  );
}

function outPlacesMatchedAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_facilities.v1.json"
  );
}

function readJson<T>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function pickAddressKeyFromMatchedRow(row: any): string | null {
  const ak = row?.addressKey;
  if (typeof ak === "string" && ak.trim()) return ak.trim();
  const candAk = row?.candidate?.addressKey;
  if (typeof candAk === "string" && candAk.trim()) return candAk.trim();
  return null;
}

export function enrichPlacesMatchedWithFacilities() {
  const facAbs = facilityIndexAbs();
  const placesAbs = placesMatchedAbs();
  const outAbs = outPlacesMatchedAbs();

  if (!fs.existsSync(facAbs)) throw new Error(`Missing facility index: ${facAbs}`);
  if (!fs.existsSync(placesAbs)) throw new Error(`Missing places_matched: ${placesAbs}`);

  const facDoc: FacilityIndexDoc = readJson<FacilityIndexDoc>(facAbs);
  const doc: any = readJson<any>(placesAbs);

  const facilitiesByAk = new Map<string, any>();
  const facilitiesByNorm = new Map<string, any>();
  const facilitiesByBase = new Map<string, any>();

  for (const f of facDoc.facilities || []) {
    const ak = String(f.addressKey || "").trim();
    if (!ak) continue;
    facilitiesByAk.set(ak, f);
    const n = makeAddressKeyLooseNorm(ak);
    if (n) facilitiesByNorm.set(n, f);
    const b = makeAddressKeyLooseBase(ak);
    if (b) facilitiesByBase.set(b, f);
  }

  const rows = Array.isArray(doc?.rows) ? doc.rows : [];
  let attached = 0,
    attachedExact = 0,
    attachedNorm = 0,
    attachedBase = 0;

  const nextRows = rows.map((r: any) => {
    const ak = pickAddressKeyFromMatchedRow(r);
    if (!ak) return r;

    let fac = facilitiesByAk.get(ak);
    let matchMode: "exact" | "norm" | "base" | null = null;

    if (fac) matchMode = "exact";
    if (!fac) {
      const n = makeAddressKeyLooseNorm(ak);
      fac = n ? facilitiesByNorm.get(n) : null;
      if (fac) matchMode = "norm";
    }
    if (!fac) {
      const b = makeAddressKeyLooseBase(ak);
      fac = b ? facilitiesByBase.get(b) : null;
      if (fac) matchMode = "base";
    }
    if (!fac) return r;

    attached += 1;
    if (matchMode === "exact") attachedExact += 1;
    if (matchMode === "norm") attachedNorm += 1;
    if (matchMode === "base") attachedBase += 1;

    return {
      ...r,
      facility: {
        facilityId: fac.facilityId,
        displayName: fac.displayName,
        brand: fac.brand,
        category: fac.category,
        phone: fac.phone,
        website: fac.website,
        types: fac.types,
        addressKey: fac.addressKey,
        matchMode,
      },
    };
  });

  const outDoc: any = {
    ...doc,
    kind: doc.kind || "places_matched",
    version: "v1_facilities_v1",
    source: {
      ...(doc.source || {}),
      facilities: "data/co/dora/denver_metro/facilities/derived/facility_index.v1.json",
    },
    counts: {
      ...(doc.counts || {}),
      facilitiesAttached: attached,
      facilitiesAttachedExact: attachedExact,
      facilitiesAttachedNorm: attachedNorm,
      facilitiesAttachedBase: attachedBase,
      facilitiesTotal: facDoc.facilities?.length || 0,
    },
    rows: nextRows,
    updatedAt: nowIso(),
  };

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify(outDoc, null, 2), "utf8");

  return {
    outAbs,
    attached,
    attachedExact,
    attachedNorm,
    attachedBase,
    facilitiesTotal: facDoc.facilities?.length || 0,
    updatedAt: outDoc.updatedAt,
    rows: nextRows.length,
  };
}
