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

function placesInAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_top200_enriched.v1.json"
  );
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

function placesOutAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_top200_enriched_facilities.v1.json"
  );
}

function readJson<T>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function pickAddressKeyFromPlaceRow(row: any): string {
  return String(row?.addressKey || row?.address_key || "").trim();
}

export function enrichPlacesTop200WithFacilities() {
  const placesAbs = placesInAbs();
  const facAbs = facilityIndexAbs();
  const outAbs = placesOutAbs();

  if (!fs.existsSync(placesAbs)) throw new Error(`Missing places enriched file: ${placesAbs}`);
  if (!fs.existsSync(facAbs)) throw new Error(`Missing facility index: ${facAbs}`);

  const placesDoc: any = readJson<any>(placesAbs);
  const facDoc: FacilityIndexDoc = readJson<FacilityIndexDoc>(facAbs);

  const facilitiesByAk = new Map<string, any>();
  const facilitiesByNorm = new Map<string, any>();
  const facilitiesByBase = new Map<string, any>();
  for (const f of facDoc.facilities || []) {
    if (!f?.addressKey) continue;
    const ak = String(f.addressKey).trim();
    facilitiesByAk.set(ak, f);
    const nk = makeAddressKeyLooseNorm(ak);
    if (nk && !facilitiesByNorm.has(nk)) facilitiesByNorm.set(nk, f);
    const bk = makeAddressKeyLooseBase(ak);
    if (bk && !facilitiesByBase.has(bk)) facilitiesByBase.set(bk, f);
  }

  const key =
    Array.isArray(placesDoc?.rows) ? "rows" :
    Array.isArray(placesDoc?.anchors) ? "anchors" :
    Array.isArray(placesDoc?.items) ? "items" :
    null;

  if (!key) throw new Error("Places enriched doc has no rows/anchors/items array");

  const arr: any[] = placesDoc[key] || [];
  let attached = 0;
  let attachedExact = 0;
  let attachedNorm = 0;
  let attachedBase = 0;

  const nextArr = arr.map((r: any) => {
    const ak = pickAddressKeyFromPlaceRow(r);
    if (!ak) return r;

    let fac = facilitiesByAk.get(ak) ?? null;
    let matchMode: "exact" | "norm" | "base" | null = null;
    if (fac) {
      matchMode = "exact";
      attachedExact += 1;
    } else {
      const nk = makeAddressKeyLooseNorm(ak);
      if (nk) {
        fac = facilitiesByNorm.get(nk) ?? null;
        if (fac) {
          matchMode = "norm";
          attachedNorm += 1;
        }
      }
      if (!fac) {
        const bk = makeAddressKeyLooseBase(ak);
        if (bk) {
          fac = facilitiesByBase.get(bk) ?? null;
          if (fac) {
            matchMode = "base";
            attachedBase += 1;
          }
        }
      }
    }
    if (!fac) return r;

    attached += 1;
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
    ...placesDoc,
    kind: placesDoc.kind || "places_top200_enriched",
    version: "v1_facilities_v1",
    source: {
      ...(placesDoc.source || {}),
      facilities: "data/co/dora/denver_metro/facilities/derived/facility_index.v1.json",
    },
    counts: {
      ...(placesDoc.counts || {}),
      facilitiesAttached: attached,
      facilitiesAttachedExact: attachedExact,
      facilitiesAttachedNorm: attachedNorm,
      facilitiesAttachedBase: attachedBase,
      facilitiesTotal: facDoc.facilities?.length || 0,
    },
    updatedAt: nowIso(),
  };
  outDoc[key] = nextArr;

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
  };
}
