import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../../api/admin/_lib/paths";

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

function techIndexAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "tech_index.v4.json"
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

function outTechIndexAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "tech_index.v4_facilities.v1.json"
  );
}

function readJson<T>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function normText(s: unknown) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normZip(s: unknown) {
  return normText(s).replace(/[^0-9]/g, "").slice(0, 5);
}

function normStreet(s: unknown) {
  let x = normText(s);
  x = x
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\s+/g, " ")
    .trim();
  return x;
}

function splitAddressKey(addressKey: string) {
  const parts = String(addressKey || "").split("|").map((x) => x.trim());
  return {
    street: parts[0] || "",
    city: parts[1] || "",
    state: parts[2] || "",
    zip: parts[3] || "",
  };
}

function stripUnitTokens(street: string) {
  let x = normStreet(street);
  x = x.replace(/\s+(STE|SUITE|APT|APARTMENT|UNIT|FL|FLOOR)\s+[A-Z0-9\-]+$/g, "");
  x = x.replace(/\s+#\s*[A-Z0-9\-]+$/g, "");
  x = x.replace(/\s+[A-Z]\-?\d+[A-Z0-9\-]*$/g, "");
  return x.trim();
}

function makeAddressKeyNorm(addressKey: string) {
  const p = splitAddressKey(addressKey);
  const street = normStreet(p.street);
  const city = normText(p.city);
  const state = normText(p.state);
  const zip = normZip(p.zip);
  if (!street || !city || !state || !zip) return "";
  return `${street} | ${city} | ${state} | ${zip}`;
}

function makeAddressKeyBase(addressKey: string) {
  const p = splitAddressKey(addressKey);
  const street = stripUnitTokens(p.street);
  const city = normText(p.city);
  const state = normText(p.state);
  const zip = normZip(p.zip);
  if (!street || !city || !state || !zip) return "";
  return `${street} | ${city} | ${state} | ${zip}`;
}

function pickAddressKey(tech: any): string | null {
  // Your tech index root has `tech: []`, and each tech usually has `addressKey`
  const direct = tech?.addressKey;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const addr = tech?.address;
  if (addr?.addressKey) return String(addr.addressKey).trim();

  // Some schemas store addresses[]
  const addrs = tech?.addresses;
  if (Array.isArray(addrs) && addrs.length) {
    for (const a of addrs) {
      const ak = a?.addressKey;
      if (typeof ak === "string" && ak.trim()) return ak.trim();
    }
  }

  return null;
}

export function enrichTechIndexWithFacilities() {
  const techAbs = techIndexAbs();
  const facAbs = facilityIndexAbs();
  const outAbs = outTechIndexAbs();

  if (!fs.existsSync(techAbs)) throw new Error(`Missing tech index: ${techAbs}`);
  if (!fs.existsSync(facAbs)) throw new Error(`Missing facility index: ${facAbs}`);

  const techDoc: any = readJson<any>(techAbs);
  const facDoc: FacilityIndexDoc = readJson<FacilityIndexDoc>(facAbs);

  const facilitiesByAk = new Map<string, any>();
  const facilitiesByNorm = new Map<string, any>();
  const facilitiesByBase = new Map<string, any>();
  for (const f of facDoc.facilities || []) {
    if (!f?.addressKey) continue;
    const ak = String(f.addressKey).trim();
    facilitiesByAk.set(ak, f);
    const nk = makeAddressKeyNorm(ak);
    if (nk && !facilitiesByNorm.has(nk)) facilitiesByNorm.set(nk, f);
    const bk = makeAddressKeyBase(ak);
    if (bk && !facilitiesByBase.has(bk)) facilitiesByBase.set(bk, f);
  }

  const techArr = Array.isArray(techDoc.tech) ? techDoc.tech : [];
  let attached = 0;
  let matchedExact = 0;
  let matchedNorm = 0;
  let matchedBase = 0;

  const nextTech = techArr.map((t: any) => {
    const ak = pickAddressKey(t);
    const akNorm = ak ? makeAddressKeyNorm(ak) : "";
    const akBase = ak ? makeAddressKeyBase(ak) : "";
    let matchMode: "exact" | "norm" | "base" | null = null;
    let fac = ak ? facilitiesByAk.get(ak) : null;
    if (fac) {
      matchMode = "exact";
      matchedExact += 1;
    } else if (akNorm) {
      fac = facilitiesByNorm.get(akNorm) ?? null;
      if (fac) {
        matchMode = "norm";
        matchedNorm += 1;
      }
    }
    if (!fac && akBase) {
      fac = facilitiesByBase.get(akBase) ?? null;
      if (fac) {
        matchMode = "base";
        matchedBase += 1;
      }
    }
    if (!fac) return t;

    attached += 1;
    return {
      ...t,
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

  const outDoc = {
    ...techDoc,
    kind: techDoc.kind || "tech_index",
    version: "v4_facilities_v1",
    source: {
      ...(techDoc.source || {}),
      facilities: "data/co/dora/denver_metro/facilities/derived/facility_index.v1.json",
    },
    counts: {
      ...(techDoc.counts || {}),
      facilitiesAttached: attached,
      facilitiesTotal: facDoc.facilities?.length || 0,
      facilitiesAttachedExact: matchedExact,
      facilitiesAttachedNorm: matchedNorm,
      facilitiesAttachedBase: matchedBase,
    },
    tech: nextTech,
    updatedAt: nowIso(),
  };

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify(outDoc, null, 2), "utf8");

  return {
    outAbs,
    attached,
    facilitiesTotal: facDoc.facilities?.length || 0,
    matchedExact,
    matchedNorm,
    matchedBase,
    updatedAt: outDoc.updatedAt,
  };
}
