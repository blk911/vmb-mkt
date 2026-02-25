import fs from "fs";
import crypto from "crypto";

const IN_PATH =
  "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";

const OUT_PATH =
  "data/co/dora/denver_metro/places/derived/tech_index.v1_1.json";

const OUT_CITYZIP_PATH =
  "data/co/dora/denver_metro/places/derived/tech_by_city_zip.v1.json";

type CandidateRow = {
  addressKey: string;
  candidate?: {
    placeName?: string;
    types?: string[];
    phone?: string;
    website?: string;
    matchScore?: number;
  };
};

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(path: string) {
  const dir = path.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function norm(s: string) {
  return (s || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function normStreet(s: string) {
  let x = norm(s);
  x = x.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

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
    .replace(/\bTERRACE\b/g, "TER");

  x = x
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W");

  x = x.replace(/\s+/g, " ").trim();
  return x;
}

function stripUnitTokens(street: string) {
  let x = normStreet(street);
  x = x.replace(/\s+(STE|SUITE|APT|APARTMENT|UNIT|FL|FLOOR)\s+[A-Z0-9\-]+$/g, "");
  x = x.replace(/\s+#\s*[A-Z0-9\-]+$/g, "");
  return x.trim();
}

function normalizeAddressKey(addressKey: string) {
  // expected: "STREET | CITY | ST | ZIP"
  const parts = (addressKey || "").split("|").map((s) => s.trim());
  const street = parts[0] || "";
  const city = parts[1] || "";
  const state = parts[2] || "";
  const zip = (parts[3] || "").replace(/[^0-9]/g, "").slice(0, 5);

  const streetNorm = normStreet(street);
  const streetBase = stripUnitTokens(street);

  const cityNorm = norm(city);
  const stateNorm = norm(state);

  const addressKeyNorm =
    streetNorm && cityNorm && stateNorm && zip
      ? `${streetNorm} | ${cityNorm} | ${stateNorm} | ${zip}`
      : "";

  const addressKeyBase =
    streetBase && cityNorm && stateNorm && zip
      ? `${streetBase} | ${cityNorm} | ${stateNorm} | ${zip}`
      : "";

  return { streetNorm, streetBase, addressKeyNorm, addressKeyBase };
}

function parseAddressKey(addressKey: string) {
  // expected format: "2763 W ASBURY AVE | DENVER | CO | 80219"
  const parts = addressKey.split("|").map((s) => s.trim());
  const street = parts[0] ?? "";
  const city = parts[1] ?? "";
  const state = parts[2] ?? "";
  const zip = parts[3] ?? "";
  return { street, city, state, zip };
}

function normId(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error({ ok: false, error: "missing_input", path: IN_PATH });
    process.exit(1);
  }

  const inText = fs.readFileSync(IN_PATH, "utf8");
  const inJson = JSON.parse(inText);
  const rows: CandidateRow[] = inJson.rows || [];

  // Build 1 TechEntity per unique addressKey (premise-first)
  const byAddressKey = new Map<string, any>();

  for (const r of rows) {
    const addressKey = (r.addressKey || "").trim();
    if (!addressKey) continue;

    const addr = parseAddressKey(addressKey);
    const nk = normalizeAddressKey(addressKey);

    const placeName = (r.candidate?.placeName || "").trim();
    const types = Array.isArray(r.candidate?.types) ? r.candidate!.types! : [];
    const phone = (r.candidate?.phone || "").trim();
    const website = (r.candidate?.website || "").trim();
    const matchScore = Number(r.candidate?.matchScore ?? 0) || 0;

    const id = normId(`${addr.street}|${addr.city}|${addr.state}|${addr.zip}`);

    const existing = byAddressKey.get(addressKey);
    if (!existing) {
      byAddressKey.set(addressKey, {
        id,
        addressKey,
        addressKeyNorm: nk.addressKeyNorm,
        addressKeyBase: nk.addressKeyBase,
        address: addr,
        addressNorm: {
          streetNorm: nk.streetNorm,
          streetBase: nk.streetBase,
        },
        // Display name is placeholder until we join DORA roster techs
        displayName: placeName || addr.street || addressKey,
        premise: {
          types,
          phone: phone || null,
          website: website || null,
          matchScore,
        },
        // placeholders for later joins
        techSignals: {
          doraLicenses: 0,
          corpSuiteSignal: 0,
          seatAggregSignal: 0,
          indieTechSignal: 0,
        },
        tags: [],
        updatedAt: new Date().toISOString(),
      });
    } else {
      // if multiple rows per addressKey, keep the "best" fields
      existing.displayName =
        existing.displayName || placeName || addr.street || addressKey;

      const exScore = Number(existing.premise?.matchScore ?? 0) || 0;
      if (matchScore > exScore) existing.premise.matchScore = matchScore;

      if (!existing.premise.phone && phone) existing.premise.phone = phone;
      if (!existing.premise.website && website) existing.premise.website = website;

      const exTypes = new Set<string>(existing.premise.types || []);
      for (const t of types) exTypes.add(t);
      existing.premise.types = Array.from(exTypes);
      existing.addressKeyNorm ||= nk.addressKeyNorm;
      existing.addressKeyBase ||= nk.addressKeyBase;
      existing.addressNorm ||= { streetNorm: nk.streetNorm, streetBase: nk.streetBase };
    }
  }

  const tech = Array.from(byAddressKey.values());

  // city/zip index for UI filters
  const cityZip: Record<string, Record<string, string[]>> = {};
  for (const t of tech) {
    const city = (t.address?.city || "UNKNOWN").toUpperCase();
    const zip = (t.address?.zip || "00000").toString();
    cityZip[city] ||= {};
    cityZip[city][zip] ||= [];
    cityZip[city][zip].push(t.id);
  }

  // stable ordering (deterministic output)
  tech.sort((a, b) => (a.addressKey < b.addressKey ? -1 : a.addressKey > b.addressKey ? 1 : 0));

  const outObj = {
    ok: true,
    kind: "tech_index",
    version: "v1.1",
    source: {
      rel: IN_PATH,
      sha256: sha256(inText),
      rows: rows.length,
      uniqAddressKey: byAddressKey.size,
    },
    counts: {
      tech: tech.length,
      cities: Object.keys(cityZip).length,
    },
    tech,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(OUT_PATH);
  const outText = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(OUT_PATH, outText, "utf8");

  ensureDirForFile(OUT_CITYZIP_PATH);
  fs.writeFileSync(OUT_CITYZIP_PATH, JSON.stringify(cityZip, null, 2), "utf8");

  console.log({
    ok: true,
    wrote: [OUT_PATH, OUT_CITYZIP_PATH],
    counts: { tech: tech.length, cities: Object.keys(cityZip).length },
    sha256: {
      tech_index: sha256(outText),
      tech_by_city_zip: sha256(fs.readFileSync(OUT_CITYZIP_PATH, "utf8")),
    },
  });
}

main();
