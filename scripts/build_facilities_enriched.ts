import fs from "node:fs";
import path from "node:path";

type RegRow = {
  addressKey?: string;
  rollupKey?: string;
  businessName?: string;
  status?: string;
  licenseNumber?: string;
  // allow extra fields
  [k: string]: any;
};

type TechRow = {
  techId?: string;
  addressKey?: string;
  [k: string]: any;
};

type FacilityRow = {
  addressKey: string;
  rollupKey: string | null;
  businessName: string;
  status: "Active" | "Expired" | "Unknown";
  licenseNumber: string;
  techCountAtAddress: number;
  sampleTechIds: string[];
  bucket: "solo" | "indie" | "suite-signal";
  franchiseBrandId: string | null;
  placeType: "salon" | "suite" | "home" | null;
};

const CFG = {
  REG_JSON: "data/co/dora/denver_metro/tables/vmb_registrations.json",
  TECH_JSON: "data/co/dora/denver_metro/derived/tech_ids_by_address.v2.json",
  ROLLUP_MAP_JSON: "data/co/dora/denver_metro/tables/vmb_address_to_rollup.json",
  OUT_JSON: "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json",
  SAMPLE_TECH_IDS: 8,
  BUCKET: { SOLO_MAX: 1, INDIE_MAX: 9, SUITE_SIGNAL_MIN: 10 },
  METRO_CITIES: [
    "DENVER", "AURORA", "LAKEWOOD", "ARVADA", "WESTMINSTER", "THORNTON", "CENTENNIAL",
    "HIGHLANDS RANCH", "LITTLETON", "ENGLEWOOD", "WHEAT RIDGE", "COMMERCE CITY",
    "NORTHGLENN", "BROOMFIELD", "GOLDEN", "PARKER", "CASTLE ROCK", "LONE TREE",
  ],
  METRO_ONLY: true,
};

function mustReadJson<T = any>(rel: string): T {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing required file: ${rel} (abs: ${abs})`);
  }
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw) as T;
}

function readJsonIfExists<T = any>(rel: string): T | null {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw) as T;
}

function ensureDirForFile(relFile: string) {
  const abs = path.resolve(process.cwd(), relFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function normalizeStatus(s: any): "Active" | "Expired" | "Unknown" {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return "Unknown";
  if (v.includes("active")) return "Active";
  if (v.includes("expire") || v.includes("inactive") || v.includes("lapsed")) return "Expired";
  return "Unknown";
}

function bucketForCount(n: number): FacilityRow["bucket"] {
  if (n <= CFG.BUCKET.SOLO_MAX) return "solo";
  if (n <= CFG.BUCKET.INDIE_MAX) return "indie";
  return "suite-signal";
}

function coerceString(v: any): string {
  const s = String(v ?? "").trim();
  return s;
}

function normToken(x: string) {
  return x
    .toUpperCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .replace(/[^A-Z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normAddressLine(x: string) {
  let v = normToken(x);

  // strip leading junk that survived as tokens
  v = v.replace(/^(;|\?|"|')+\s*/g, "").trim();

  // normalize common unit markers
  v = v
    .replace(/\bAPARTMENT\b/g, "APT")
    .replace(/\bSUITE\b/g, "STE")
    .replace(/\bSTE\b/g, "STE")
    .replace(/\bUNIT\b/g, "UNIT")
    .replace(/\bFLOOR\b/g, "FL")
    .replace(/\bROOM\b/g, "RM");

  // normalize "# 12" -> "#12"
  v = v.replace(/#\s+(\w+)/g, "#$1");

  return v;
}

function makeCanonicalAddressKey(parts: {
  a1: string;
  a2?: string;
  city: string;
  state: string;
  zip?: string;
}) {
  const a1 = normAddressLine(parts.a1);
  const a2 = parts.a2 ? normAddressLine(parts.a2) : "";
  const city = normToken(parts.city);
  const state = normToken(parts.state);
  const zip = normToken(parts.zip ?? "");

  if (!a1 || !city || !state) return "";

  const out = [a1];
  if (a2) out.push(a2);
  out.push(city, state);
  if (zip) out.push(zip);

  return out.join(" | ");
}

function pickBusinessName(reg: RegRow): string {
  return (
    coerceString(reg.businessName) ||
    coerceString(reg["shopName"]) ||
    coerceString(reg["shop_name"]) ||
    coerceString(reg["dba"]) ||
    coerceString(reg["dbaName"]) ||
    coerceString(reg["entityName"]) ||
    coerceString(reg["entity_name"]) ||
    coerceString(reg["name"]) ||
    "Unknown"
  );
}

function pickLicenseNumber(reg: RegRow): string {
  return (
    coerceString(reg.licenseNumber) ||
    coerceString(reg["registrationNumber"]) ||
    coerceString(reg["registration_number"]) ||
    coerceString(reg["licenseNo"]) ||
    coerceString(reg["license_no"]) ||
    coerceString(reg["regNumber"]) ||
    coerceString(reg["reg_number"]) ||
    ""
  );
}

/**
 * Prefer an existing addressKey if it looks physical.
 * If addressKey is missing (or looks like CITY STATE), build it from address parts.
 */
function pickAddressKey(reg: RegRow): string {
  const existing =
    coerceString(reg.addressKey) ||
    coerceString(reg["addrKey"]) ||
    coerceString(reg["address_key"]) ||
    "";

  // reject city-only keys like "DENVER CO"
  const looksCityOnly = /^[A-Z\s]+ [A-Z]{2}$/.test(existing) && !existing.includes("|") && !/\d/.test(existing);
  if (existing && !looksCityOnly) {
    // if it already contains separators, normalize each segment
    if (existing.includes("|")) {
      const segs = existing.split("|").map((p) => p.trim());
      const [p1, p2, p3, p4, p5] = segs;
      // handles both 4-part and 5-part variants
      if (segs.length >= 4) {
        return makeCanonicalAddressKey({
          a1: p1 ?? "",
          a2: segs.length === 5 ? (p2 ?? "") : "",
          city: segs.length === 5 ? (p3 ?? "") : (p2 ?? ""),
          state: segs.length === 5 ? (p4 ?? "") : (p3 ?? ""),
          zip: segs.length === 5 ? (p5 ?? "") : "",
        });
      }
    }
    return normToken(existing);
  }

  const a1 =
    coerceString(reg["address1"]) ||
    coerceString(reg["addr1"]) ||
    coerceString(reg["street"]) ||
    coerceString(reg["street1"]) ||
    "";

  const a2 =
    coerceString(reg["address2"]) ||
    coerceString(reg["addr2"]) ||
    coerceString(reg["street2"]) ||
    "";

  const city =
    coerceString(reg["city"]) ||
    coerceString(reg["town"]) ||
    "";

  const state =
    coerceString(reg["state"]) ||
    coerceString(reg["st"]) ||
    "";

  const zip =
    coerceString(reg["zip"]) ||
    coerceString(reg["postalCode"]) ||
    coerceString(reg["postal_code"]) ||
    "";

  if (!a1 || !city || !state) return "";
  return makeCanonicalAddressKey({ a1, a2, city, state, zip });
}

function pickRollupKey(reg: RegRow): string | null {
  const v =
    coerceString(reg.rollupKey) ||
    coerceString(reg["rollup_key"]) ||
    coerceString(reg["addrRollupKey"]) ||
    "";
  return v || null;
}

function getCityFromAddressKey(addressKey: string): string {
  // addressKey format: "... | CITY | ST | ZIP?"
  const parts = addressKey.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return "";
  // We standardized: [addr1, (addr2?), city, state, (zip?)].
  // Prefer city at -3; fallback to -2 when key has no zip and no addr2.
  return (parts[parts.length - 3] ?? parts[parts.length - 2] ?? "").toUpperCase();
}

function isMetro(addressKey: string): boolean {
  const city = getCityFromAddressKey(addressKey);
  return CFG.METRO_CITIES.includes(city);
}

function main() {
  const regRaw = mustReadJson<any>(CFG.REG_JSON);
  const regRows: RegRow[] = Array.isArray(regRaw?.rows) ? regRaw.rows : Array.isArray(regRaw) ? regRaw : [];
  const techRaw = mustReadJson<any>(CFG.TECH_JSON);
  const techRows: TechRow[] = Array.isArray(techRaw?.rows) ? techRaw.rows : Array.isArray(techRaw) ? techRaw : [];
  const rollupMap = readJsonIfExists<Record<string, string>>(CFG.ROLLUP_MAP_JSON) ?? {};

  // 1) Index techs by addressKey (supports both row shapes)
  // A) raw rows: { techId, addressKey }
  // B) aggregated: { addressKey, techIds: string[] }
  const techByAddress = new Map<string, string[]>();
  for (const t of techRows as any[]) {
    const addressKey = String(t.addressKey ?? "").trim();
    if (!addressKey) continue;

    // aggregated form
    if (Array.isArray(t.techIds)) {
      const arr = techByAddress.get(addressKey) ?? [];
      for (const id of t.techIds) {
        const techId = String(id ?? "").trim();
        if (techId) arr.push(techId);
      }
      techByAddress.set(addressKey, arr);
      continue;
    }

    // raw form
    const techId = String(t.techId ?? "").trim();
    if (!techId) continue;

    const arr = techByAddress.get(addressKey) ?? [];
    arr.push(techId);
    techByAddress.set(addressKey, arr);
  }

  // 2) Index REG by addressKey (prefer Active, else stable deterministic pick)
  const regByAddress = new Map<string, RegRow>();
  for (const r of regRows) {
    const addressKey = pickAddressKey(r);
    if (!addressKey) continue;

    const existing = regByAddress.get(addressKey);
    if (!existing) {
      regByAddress.set(addressKey, r);
      continue;
    }

    // deterministic preference: Active > Unknown > Expired
    const a = normalizeStatus(r.status);
    const b = normalizeStatus(existing.status);
    const score = (s: FacilityRow["status"]) => (s === "Active" ? 3 : s === "Unknown" ? 2 : 1);

    if (score(a) > score(b)) {
      regByAddress.set(addressKey, r);
      continue;
    }

    // tie-breaker: stable lexical licenseNumber then businessName
    if (score(a) === score(b)) {
      const la = pickLicenseNumber(r);
      const lb = pickLicenseNumber(existing);
      if (la && lb && la.localeCompare(lb) < 0) {
        regByAddress.set(addressKey, r);
        continue;
      }
      if (la && !lb) {
        regByAddress.set(addressKey, r);
        continue;
      }
      const na = pickBusinessName(r);
      const nb = pickBusinessName(existing);
      if (na.localeCompare(nb) < 0) {
        regByAddress.set(addressKey, r);
      }
    }
  }

  // 3) Union keys across REG + Tech (so we don’t lose tech-only addresses)
  const allAddressKeys = new Set<string>();
  for (const k of regByAddress.keys()) allAddressKeys.add(k);
  for (const k of techByAddress.keys()) allAddressKeys.add(k);

  const out: FacilityRow[] = [];

  for (const addressKey of Array.from(allAddressKeys).sort((a, b) => a.localeCompare(b))) {
    const reg = regByAddress.get(addressKey) ?? {};
    const techIds = (techByAddress.get(addressKey) ?? []).slice().sort((a, b) => a.localeCompare(b));
    const techCount = techIds.length;

    const rollupKey =
      pickRollupKey(reg) ??
      (rollupMap[addressKey] ? String(rollupMap[addressKey]) : null);

    const row: FacilityRow = {
      addressKey,
      rollupKey: rollupKey || null,
      businessName: pickBusinessName(reg),
      status: normalizeStatus(reg.status),
      licenseNumber: pickLicenseNumber(reg),
      techCountAtAddress: techCount,
      sampleTechIds: techIds.slice(0, CFG.SAMPLE_TECH_IDS),
      bucket: bucketForCount(techCount),
      franchiseBrandId: null,
      placeType: null,
    };

    if (CFG.METRO_ONLY && !isMetro(addressKey)) continue;
    out.push(row);
  }

  // 4) Write output
  ensureDirForFile(CFG.OUT_JSON);
  const absOut = path.resolve(process.cwd(), CFG.OUT_JSON);

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: {
      facilities: out.length,
      withTechs: out.filter((r) => r.techCountAtAddress > 0).length,
      suiteSignal: out.filter((r) => r.bucket === "suite-signal").length,
    },
    rows: out,
  };

  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2), "utf8");
  console.log(`WROTE ${CFG.OUT_JSON}`);
  console.log(payload.counts);
}

main();
