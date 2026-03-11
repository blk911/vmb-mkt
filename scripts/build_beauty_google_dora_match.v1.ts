import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type GoogleZoneMember = {
  zone_id: string;
  zone_name: string;
  market: string;
  location_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  distance_miles: number;
  category_raw?: string;
  category_source_labels_raw?: string[];
  google_types_raw?: string[];
  category?: string;
  subtype?: string;
  source?: string;
  priority_score?: number;
  is_anchor?: boolean;
};

type CandidateRow = {
  addressKey?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  topPlaceId?: string;
  chosenPlaceId?: string;
  query?: string;
  candidate?: {
    placeName?: string;
    address?: string;
    website?: string;
    phone?: string;
    types?: string[];
    lat?: number;
    lon?: number;
  };
  lat?: number;
  lon?: number;
};

type DoraRosterRow = {
  rowId?: string;
  fullName?: string;
  street?: string;
  streetBase?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressKey?: string;
  addressKeyBase?: string;
  licenseType?: string;
  licenseStatus?: string;
  raw?: Record<string, unknown>;
};

type DoraCoordsFile = {
  rows?: Array<{
    addressKey: string;
    lat: number;
    lon: number;
    source?: string;
    updatedAt?: string;
  }>;
};

type DoraCoordRow = {
  addressKey: string;
  lat: number;
  lon: number;
  source?: string;
  updatedAt?: string;
};

type GoogleCandidate = {
  id: string;
  zone_id: string;
  zone_name: string;
  market: string;
  location_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  category: string;
  category_raw: string;
  category_source_labels_raw: string[];
  google_types_raw: string[];
  subtype: string;
  source: string;
  priority_score: number;
  is_anchor: boolean;
  phone: string;
  phone_normalized: string;
  website: string;
  website_domain: string;
  top_place_id: string;
  chosen_place_id: string;
  matched_queries_raw: string[];
  normalized_name: string;
  normalized_name_tokens: string[];
  normalized_address_key: string;
  normalized_address_key_base: string;
};

type DoraLicense = {
  row_id: string;
  full_name: string;
  entity_name: string;
  address_key: string;
  address_key_base: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  license_type_raw: string;
  license_status_raw: string;
  operational_category: string;
  raw_profession_label: string;
};

type DoraAddressGroup = {
  id: string;
  address_key: string;
  address_key_base: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  coord_source: string;
  active_license_count: number;
  operational_mix: Record<string, number>;
  raw_license_types: string[];
  raw_license_statuses: string[];
  raw_profession_labels: string[];
  raw_names: string[];
  raw_entity_names: string[];
  normalized_name_candidates: string[];
  normalized_name_token_sets: string[][];
  licenses: DoraLicense[];
};

type MatchRecord = {
  match_id: string;
  google: {
    id: string;
    location_id: string;
    zone_id: string;
    zone_name: string;
    market: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lon: number;
    category: string;
    category_raw: string;
    category_source_labels_raw: string[];
    google_types_raw: string[];
    subtype: string;
    source: string;
    priority_score: number;
    is_anchor: boolean;
    phone: string;
    website: string;
    website_domain: string;
    top_place_id: string;
    chosen_place_id: string;
  };
  dora: {
    id: string;
    address_key: string;
    address_key_base: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lon: number;
    coord_source: string;
    active_license_count: number;
    operational_mix: Record<string, number>;
    raw_license_types: string[];
    raw_license_statuses: string[];
    raw_profession_labels: string[];
    raw_names: string[];
    raw_entity_names: string[];
    license_row_ids: string[];
  };
  normalized: {
    google_name: string;
    dora_name: string;
    google_address_key: string;
    dora_address_key: string;
    exact_address_match: boolean;
    base_address_match: boolean;
    distance_miles: number;
    distance_meters: number;
    token_overlap: number;
    fuzzy_similarity: number;
    exact_name_match: boolean;
  };
  scores: {
    name_score: number;
    address_score: number;
    distance_score: number;
    category_score: number;
    phone_score: number;
    website_score: number;
    final_match_score: number;
  };
  match_confidence: "strong" | "likely" | "weak";
};

const ROOT = process.cwd();
const GOOGLE_MEMBERS_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");
const GOOGLE_CANDIDATES_PATH = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "places",
  "derived",
  "places_candidates.v1.json"
);
const DORA_ROSTER_PATH = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "derived",
  "dora_roster_index.v1.json"
);
const DORA_COORDS_PATH = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "derived",
  "dora_address_coords.v1.json"
);

const MATCH_MASTER_PATH = path.join(ROOT, "data", "markets", "beauty_match_master.v1.json");
const GOOGLE_UNMATCHED_PATH = path.join(ROOT, "data", "markets", "google_unmatched.v1.json");
const DORA_UNMATCHED_PATH = path.join(ROOT, "data", "markets", "dora_unmatched.v1.json");

const MIN_MATCH_SCORE = 50;
const STRONG_MATCH_SCORE = 80;
const LIKELY_MATCH_SCORE = 65;
const MAX_DISTANCE_MILES = 0.5;

const NAME_FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "beauty",
  "co",
  "company",
  "for",
  "inc",
  "llc",
  "salon",
  "shop",
  "spa",
  "studio",
]);

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function s(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => s(value)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function normalizeText(value: string) {
  return s(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeStreet(value: string) {
  return normalizeText(value)
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\b(northeast)\b/g, "ne")
    .replace(/\b(northwest)\b/g, "nw")
    .replace(/\b(southeast)\b/g, "se")
    .replace(/\b(southwest)\b/g, "sw")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(place)\b/g, "pl")
    .replace(/\b(terrace)\b/g, "ter")
    .replace(/\b(parkway)\b/g, "pkwy")
    .replace(/\b(highway)\b/g, "hwy")
    .replace(/\s+/g, " ")
    .trim();
}

function stripUnitTokens(value: string) {
  return canonicalizeStreet(value)
    .replace(/\b(apt|unit|ste|suite|fl|floor|rm|room|bldg|building|lot|#)\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !NAME_FILLER_WORDS.has(token))
    .join(" ")
    .trim();
}

function tokenizeNormalizedName(value: string) {
  return uniqueSorted(
    normalizeName(value)
      .split(" ")
      .filter((token) => token.length >= 2)
  );
}

function normalizeZip(zip: string) {
  return s(zip).replace(/[^0-9]/g, "").slice(0, 5);
}

function normalizePhone(phone: string) {
  return s(phone).replace(/[^0-9]/g, "");
}

function parseAddressKey(addressKey: string) {
  const [street = "", city = "", state = "", zip = ""] = s(addressKey)
    .split("|")
    .map((part) => s(part));
  return { street, city, state, zip };
}

function buildAddressKey(street: string, city: string, state: string, zip: string) {
  return [canonicalizeStreet(street), normalizeText(city), normalizeText(state), normalizeZip(zip)].join("|");
}

function buildAddressKeyBase(street: string, city: string, state: string, zip: string) {
  return [stripUnitTokens(street), normalizeText(city), normalizeText(state), normalizeZip(zip)].join("|");
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function milesToMeters(miles: number) {
  return miles * 1609.344;
}

function tokenOverlapScore(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? overlap / union : 0;
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function fuzzySimilarity(a: string, b: string) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (!maxLen) return 0;
  return Math.max(0, 1 - levenshteinDistance(left, right) / maxLen);
}

function extractDomain(url: string) {
  const value = s(url);
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function domainTokens(domain: string) {
  return uniqueSorted(
    s(domain)
      .replace(/\.[a-z]+$/i, "")
      .split(/[^a-z0-9]+/i)
      .map((token) => token.toLowerCase())
      .filter((token) => token.length >= 2 && !NAME_FILLER_WORDS.has(token))
  );
}

function confidenceForScore(score: number): "strong" | "likely" | "weak" {
  if (score >= STRONG_MATCH_SCORE) return "strong";
  if (score >= LIKELY_MATCH_SCORE) return "likely";
  return "weak";
}

function stableMatchId(googleId: string, doraId: string) {
  return crypto.createHash("sha1").update(`${googleId}::${doraId}`).digest("hex").slice(0, 16);
}

function classifyLicenseType(licenseType: string) {
  const normalized = normalizeText(licenseType).toUpperCase();
  const category =
    normalized === "MAN" ||
    normalized.includes("NAIL") ||
    normalized.includes("NAIL TECHNICIAN") ||
    normalized.includes("NAIL SPECIALIST") ||
    normalized.includes("MANICURIST")
      ? "nail"
      : normalized === "BAR" || normalized.includes("BARBER")
        ? "barber"
        : normalized === "COZ" ||
            normalized.includes("ESTHETICIAN") ||
            normalized.includes("AESTHETICIAN") ||
            normalized.includes("SKIN CARE") ||
            normalized.includes("WAXING") ||
            normalized.includes("LASH") ||
            normalized.includes("BROW")
          ? "esthe"
          : normalized.includes("SPA") || normalized.includes("DAY SPA")
            ? "spa"
            : normalized === "COS" ||
                normalized === "HST" ||
                normalized.includes("COSMETOLOGY") ||
                normalized.includes("COSMETOLOGIST") ||
                normalized.includes("HAIRSTYLIST") ||
                normalized.includes("HAIRDRESSER") ||
                normalized.includes("HAIR")
              ? "hair"
              : "other";

  return {
    category,
    rawLabel: s(licenseType) || "UNKNOWN",
  };
}

function pickLatLonFromCandidate(row: CandidateRow) {
  const lat = num(row.candidate?.lat) ?? num(row.lat);
  const lon = num(row.candidate?.lon) ?? num(row.lon);
  return { lat, lon };
}

function pickBestCandidateAugmentation(member: GoogleZoneMember, candidates: CandidateRow[]) {
  const memberName = normalizeName(member.name);
  const memberAddressBase = buildAddressKeyBase(member.address, member.city, member.state, member.zip);
  let best: { score: number; row: CandidateRow } | null = null;

  for (const row of candidates) {
    const candidateName = normalizeName(s(row.candidate?.placeName) || s((row as { name?: string }).name));
    const parsed = s(row.addressKey) ? parseAddressKey(s(row.addressKey)) : null;
    const candidateStreet = parsed?.street || s(row.address) || s(row.candidate?.address);
    const candidateCity = parsed?.city || s(row.city);
    const candidateState = parsed?.state || s(row.state);
    const candidateZip = parsed?.zip || s(row.zip);
    const candidateAddressBase = buildAddressKeyBase(candidateStreet, candidateCity, candidateState, candidateZip);
    const candidateTokens = tokenizeNormalizedName(candidateName);
    const memberTokens = tokenizeNormalizedName(memberName);
    const { lat, lon } = pickLatLonFromCandidate(row);
    const distanceMiles =
      lat != null && lon != null ? haversineMiles(member.lat, member.lon, lat, lon) : Number.POSITIVE_INFINITY;

    let score = 0;
    if (memberAddressBase && candidateAddressBase && memberAddressBase === candidateAddressBase) score += 90;
    if (memberName && candidateName && memberName === candidateName) score += 70;
    score += Math.round(30 * tokenOverlapScore(memberTokens, candidateTokens));
    if (distanceMiles <= 0.02) score += 20;
    else if (distanceMiles <= 0.05) score += 10;

    if (normalizeZip(member.zip) && normalizeZip(member.zip) === normalizeZip(candidateZip)) score += 5;
    if (score < 70) continue;

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        `${s(row.candidate?.placeName)}|${s(row.addressKey)}|${s(row.chosenPlaceId)}`.localeCompare(
          `${s(best.row.candidate?.placeName)}|${s(best.row.addressKey)}|${s(best.row.chosenPlaceId)}`
        ) < 0)
    ) {
      best = { score, row };
    }
  }

  return best?.row || null;
}

function buildGoogleRows(membersFile: { members?: GoogleZoneMember[] }, candidatesFile: { rows?: CandidateRow[] }) {
  const members = (membersFile.members || [])
    .filter((member) => num(member.lat) != null && num(member.lon) != null)
    .slice()
    .sort((a, b) =>
      [a.zone_id, a.name, a.address, a.location_id].join("|").localeCompare(
        [b.zone_id, b.name, b.address, b.location_id].join("|")
      )
    );

  const candidateRows = candidatesFile.rows || [];

  return members.map((member) => {
    const augmentation = pickBestCandidateAugmentation(member, candidateRows);
    const parsed = s(augmentation?.addressKey) ? parseAddressKey(s(augmentation?.addressKey)) : null;
    const street = parsed?.street || member.address;
    const city = parsed?.city || member.city;
    const state = parsed?.state || member.state;
    const zip = parsed?.zip || member.zip;
    const website = s(augmentation?.candidate?.website);
    const phone = s(augmentation?.candidate?.phone);

    return {
      id: member.location_id,
      zone_id: member.zone_id,
      zone_name: member.zone_name,
      market: member.market,
      location_id: member.location_id,
      name: member.name,
      address: member.address,
      city: member.city,
      state: member.state,
      zip: member.zip,
      lat: member.lat,
      lon: member.lon,
      category: s(member.category) || "other",
      category_raw: s(member.category_raw) || "other",
      category_source_labels_raw: (member.category_source_labels_raw || []).map((value) => s(value)).filter(Boolean),
      google_types_raw: (member.google_types_raw || []).map((value) => s(value)).filter(Boolean),
      subtype: s(member.subtype) || "storefront",
      source: s(member.source) || "places_candidates.v1.json",
      priority_score: Number(member.priority_score || 0),
      is_anchor: member.is_anchor === true,
      phone,
      phone_normalized: normalizePhone(phone),
      website,
      website_domain: extractDomain(website),
      top_place_id: s(augmentation?.topPlaceId),
      chosen_place_id: s(augmentation?.chosenPlaceId),
      matched_queries_raw: uniqueSorted(
        s(augmentation?.query)
          .split("|")
          .map((value) => s(value))
          .filter(Boolean)
      ),
      normalized_name: normalizeName(member.name),
      normalized_name_tokens: tokenizeNormalizedName(member.name),
      normalized_address_key: buildAddressKey(street, city, state, zip),
      normalized_address_key_base: buildAddressKeyBase(street, city, state, zip),
    } satisfies GoogleCandidate;
  });
}

function buildDoraGroups(
  rosterFile: { byAddressKey?: Record<string, DoraRosterRow[]> },
  coordsFile: DoraCoordsFile
) {
  const coordsByExact = new Map<string, DoraCoordRow>();
  const coordsByBase = new Map<string, DoraCoordRow>();

  for (const row of coordsFile.rows || []) {
    coordsByExact.set(s(row.addressKey), row);
    const parsed = parseAddressKey(s(row.addressKey));
    coordsByBase.set(
      buildAddressKeyBase(parsed.street, parsed.city, parsed.state, parsed.zip),
      row
    );
  }

  const groups: DoraAddressGroup[] = [];
  let skippedNoCoords = 0;

  for (const addressKey of Object.keys(rosterFile.byAddressKey || {}).sort((a, b) => a.localeCompare(b))) {
    const rows = (rosterFile.byAddressKey?.[addressKey] || []).filter(
      (row) => s(row.licenseStatus).toUpperCase().includes("ACTIVE")
    );
    if (!rows.length) continue;

    const beautyRows = rows
      .map((row) => {
        const classification = classifyLicenseType(s(row.licenseType));
        return { row, classification };
      })
      .filter(({ classification }) => classification.category !== "other");

    if (!beautyRows.length) continue;

    const firstRow = beautyRows[0]?.row;
    const coord =
      coordsByExact.get(s(addressKey)) ||
      coordsByBase.get(buildAddressKeyBase(s(firstRow?.streetBase) || s(firstRow?.street), s(firstRow?.city), s(firstRow?.state), s(firstRow?.zip)));

    if (!coord) {
      skippedNoCoords += beautyRows.length;
      continue;
    }

    const operationalMix = { hair: 0, nail: 0, esthe: 0, barber: 0, spa: 0 };
    const licenses: DoraLicense[] = [];
    const rawNames: string[] = [];
    const rawEntityNames: string[] = [];
    const rawLicenseTypes: string[] = [];
    const rawLicenseStatuses: string[] = [];
    const rawProfessionLabels: string[] = [];

    for (const { row, classification } of beautyRows) {
      const entityName = s(row.raw?.["Entity Name"]);
      const license: DoraLicense = {
        row_id: s(row.rowId),
        full_name: s(row.fullName),
        entity_name: entityName,
        address_key: s(row.addressKey) || s(addressKey),
        address_key_base: s(row.addressKeyBase),
        street: s(row.street),
        city: s(row.city),
        state: s(row.state),
        zip: normalizeZip(s(row.zip)),
        license_type_raw: classification.rawLabel,
        license_status_raw: s(row.licenseStatus),
        operational_category: classification.category,
        raw_profession_label: classification.rawLabel,
      };
      licenses.push(license);
      operationalMix[classification.category as keyof typeof operationalMix] += 1;
      rawNames.push(license.full_name);
      rawEntityNames.push(entityName);
      rawLicenseTypes.push(license.license_type_raw);
      rawLicenseStatuses.push(license.license_status_raw);
      rawProfessionLabels.push(license.raw_profession_label);
    }

    const nameCandidates = uniqueSorted([...rawEntityNames, ...rawNames]);
    groups.push({
      id: s(addressKey),
      address_key: s(addressKey),
      address_key_base:
        s(firstRow?.addressKeyBase) ||
        buildAddressKeyBase(s(firstRow?.streetBase) || s(firstRow?.street), s(firstRow?.city), s(firstRow?.state), s(firstRow?.zip)),
      street: s(firstRow?.street),
      city: s(firstRow?.city),
      state: s(firstRow?.state),
      zip: normalizeZip(s(firstRow?.zip)),
      lat: coord.lat,
      lon: coord.lon,
      coord_source: s(coord.source) || "dora_address_coords",
      active_license_count: licenses.length,
      operational_mix: operationalMix,
      raw_license_types: uniqueSorted(rawLicenseTypes),
      raw_license_statuses: uniqueSorted(rawLicenseStatuses),
      raw_profession_labels: uniqueSorted(rawProfessionLabels),
      raw_names: uniqueSorted(rawNames),
      raw_entity_names: uniqueSorted(rawEntityNames),
      normalized_name_candidates: nameCandidates.map((value) => normalizeName(value)).filter(Boolean),
      normalized_name_token_sets: nameCandidates.map((value) => tokenizeNormalizedName(value)).filter((tokens) => tokens.length > 0),
      licenses: licenses.sort((a, b) => [a.address_key, a.row_id, a.full_name].join("|").localeCompare([b.address_key, b.row_id, b.full_name].join("|"))),
    });
  }

  return {
    groups: groups.sort((a, b) => a.address_key.localeCompare(b.address_key)),
    skippedNoCoords,
  };
}

function computeNameScore(google: GoogleCandidate, dora: DoraAddressGroup) {
  if (!google.normalized_name) {
    return {
      normalizedName: "",
      tokenOverlap: 0,
      fuzzy: 0,
      exactNameMatch: false,
      score: 0,
    };
  }

  let best = {
    normalizedName: "",
    tokenOverlap: 0,
    fuzzy: 0,
    exactNameMatch: false,
    weighted: 0,
  };

  for (let i = 0; i < dora.normalized_name_candidates.length; i += 1) {
    const doraName = dora.normalized_name_candidates[i];
    const doraTokens = dora.normalized_name_token_sets[i] || tokenizeNormalizedName(doraName);
    const overlap = tokenOverlapScore(google.normalized_name_tokens, doraTokens);
    const fuzzy = fuzzySimilarity(google.normalized_name, doraName);
    const exact = google.normalized_name === doraName && !!doraName;
    const weighted = exact ? 1 : Math.max(overlap, fuzzy * 0.85, overlap * 0.65 + fuzzy * 0.35);
    if (
      weighted > best.weighted ||
      (weighted === best.weighted && doraName.localeCompare(best.normalizedName) < 0)
    ) {
      best = {
        normalizedName: doraName,
        tokenOverlap: overlap,
        fuzzy,
        exactNameMatch: exact,
        weighted,
      };
    }
  }

  return {
    normalizedName: best.normalizedName,
    tokenOverlap: Number(best.tokenOverlap.toFixed(3)),
    fuzzy: Number(best.fuzzy.toFixed(3)),
    exactNameMatch: best.exactNameMatch,
    score: Math.round(best.weighted * 25),
  };
}

function computeAddressScore(google: GoogleCandidate, dora: DoraAddressGroup) {
  const exact = google.normalized_address_key === buildAddressKey(dora.street, dora.city, dora.state, dora.zip);
  const base = google.normalized_address_key_base === dora.address_key_base;
  const streetBaseGoogle = google.normalized_address_key_base.split("|")[0] || "";
  const streetBaseDora = dora.address_key_base.split("|")[0] || "";
  const streetSimilarity = fuzzySimilarity(streetBaseGoogle, streetBaseDora);

  let score = 0;
  if (exact) score = 25;
  else if (base) score = 22;
  else if (normalizeZip(google.zip) === dora.zip && streetSimilarity >= 0.9) score = 18;
  else if (normalizeZip(google.zip) === dora.zip && streetSimilarity >= 0.75) score = 12;

  return {
    exact,
    base,
    score,
  };
}

function computeDistanceScore(google: GoogleCandidate, dora: DoraAddressGroup) {
  const distanceMiles = haversineMiles(google.lat, google.lon, dora.lat, dora.lon);
  let score = 0;
  if (distanceMiles <= 0.01) score = 25;
  else if (distanceMiles <= 100 / 1609.344) score = 20;
  else if (distanceMiles <= 0.25) score = 12;
  else if (distanceMiles <= MAX_DISTANCE_MILES) score = 6;
  return {
    distanceMiles: Number(distanceMiles.toFixed(4)),
    distanceMeters: Math.round(milesToMeters(distanceMiles)),
    score,
  };
}

function computeCategoryScore(google: GoogleCandidate, dora: DoraAddressGroup) {
  const mix = dora.operational_mix;
  const has = (category: keyof typeof mix) => Number(mix[category] || 0) > 0;
  let compatibility = 0;

  switch (google.category) {
    case "hair":
      compatibility = has("hair") ? 1 : has("barber") ? 0.35 : 0;
      break;
    case "nail":
      compatibility = has("nail") ? 1 : 0;
      break;
    case "esthe":
      compatibility = has("esthe") ? 1 : has("spa") ? 0.55 : 0;
      break;
    case "spa":
      compatibility = has("spa") ? 1 : has("esthe") ? 0.55 : 0;
      break;
    case "barber":
      compatibility = has("barber") ? 1 : has("hair") ? 0.35 : 0;
      break;
    case "beauty":
      compatibility = Object.values(mix).some((count) => Number(count || 0) > 0) ? 0.55 : 0;
      break;
    default:
      compatibility = 0;
      break;
  }

  return {
    compatibility: Number(compatibility.toFixed(3)),
    score: Math.round(compatibility * 15),
  };
}

function computePhoneScore(_google: GoogleCandidate, _dora: DoraAddressGroup) {
  return 0;
}

function computeWebsiteScore(google: GoogleCandidate, dora: DoraAddressGroup) {
  const domain = google.website_domain;
  if (!domain) return 0;
  const domainTokenSet = new Set(domainTokens(domain));
  if (!domainTokenSet.size) return 0;
  const entityTokens = uniqueSorted(
    dora.raw_entity_names.flatMap((value) => tokenizeNormalizedName(value))
  );
  if (!entityTokens.length) return 0;
  const overlap = entityTokens.filter((token) => domainTokenSet.has(token)).length;
  if (!overlap) return 0;
  return Math.min(5, overlap * 2);
}

function buildMatchRecords(googleRows: GoogleCandidate[], doraGroups: DoraAddressGroup[]) {
  const matches: MatchRecord[] = [];

  for (const google of googleRows) {
    for (const dora of doraGroups) {
      const address = computeAddressScore(google, dora);
      const distance = computeDistanceScore(google, dora);
      if (address.score === 0 && distance.score === 0) continue;

      const name = computeNameScore(google, dora);
      const category = computeCategoryScore(google, dora);
      const phoneScore = computePhoneScore(google, dora);
      const websiteScore = computeWebsiteScore(google, dora);
      const finalScore =
        name.score + address.score + distance.score + category.score + phoneScore + websiteScore;

      if (finalScore < MIN_MATCH_SCORE) continue;
      if (category.score === 0 && google.category !== "beauty" && name.score < 18) continue;

      matches.push({
        match_id: stableMatchId(google.id, dora.id),
        google: {
          id: google.id,
          location_id: google.location_id,
          zone_id: google.zone_id,
          zone_name: google.zone_name,
          market: google.market,
          name: google.name,
          address: google.address,
          city: google.city,
          state: google.state,
          zip: google.zip,
          lat: google.lat,
          lon: google.lon,
          category: google.category,
          category_raw: google.category_raw,
          category_source_labels_raw: google.category_source_labels_raw,
          google_types_raw: google.google_types_raw,
          subtype: google.subtype,
          source: google.source,
          priority_score: google.priority_score,
          is_anchor: google.is_anchor,
          phone: google.phone,
          website: google.website,
          website_domain: google.website_domain,
          top_place_id: google.top_place_id,
          chosen_place_id: google.chosen_place_id,
        },
        dora: {
          id: dora.id,
          address_key: dora.address_key,
          address_key_base: dora.address_key_base,
          street: dora.street,
          city: dora.city,
          state: dora.state,
          zip: dora.zip,
          lat: dora.lat,
          lon: dora.lon,
          coord_source: dora.coord_source,
          active_license_count: dora.active_license_count,
          operational_mix: dora.operational_mix,
          raw_license_types: dora.raw_license_types,
          raw_license_statuses: dora.raw_license_statuses,
          raw_profession_labels: dora.raw_profession_labels,
          raw_names: dora.raw_names,
          raw_entity_names: dora.raw_entity_names,
          license_row_ids: dora.licenses.map((license) => license.row_id),
        },
        normalized: {
          google_name: google.normalized_name,
          dora_name: name.normalizedName,
          google_address_key: google.normalized_address_key,
          dora_address_key: buildAddressKey(dora.street, dora.city, dora.state, dora.zip),
          exact_address_match: address.exact,
          base_address_match: address.base,
          distance_miles: distance.distanceMiles,
          distance_meters: distance.distanceMeters,
          token_overlap: name.tokenOverlap,
          fuzzy_similarity: name.fuzzy,
          exact_name_match: name.exactNameMatch,
        },
        scores: {
          name_score: name.score,
          address_score: address.score,
          distance_score: distance.score,
          category_score: category.score,
          phone_score: phoneScore,
          website_score: websiteScore,
          final_match_score: finalScore,
        },
        match_confidence: confidenceForScore(finalScore),
      });
    }
  }

  return matches.sort((a, b) => {
    if (b.scores.final_match_score !== a.scores.final_match_score) {
      return b.scores.final_match_score - a.scores.final_match_score;
    }
    const left = [a.google.id, a.dora.id, a.match_id].join("|");
    const right = [b.google.id, b.dora.id, b.match_id].join("|");
    return left.localeCompare(right);
  });
}

function main() {
  const googleMembersFile = readJsonFile<{ members?: GoogleZoneMember[] }>(GOOGLE_MEMBERS_PATH);
  const googleCandidatesFile = readJsonFile<{ rows?: CandidateRow[] }>(GOOGLE_CANDIDATES_PATH);
  const doraRosterFile = readJsonFile<{ byAddressKey?: Record<string, DoraRosterRow[]> }>(DORA_ROSTER_PATH);
  const doraCoordsFile = readJsonFile<DoraCoordsFile>(DORA_COORDS_PATH);

  const googleRows = buildGoogleRows(googleMembersFile, googleCandidatesFile);
  const doraBuild = buildDoraGroups(doraRosterFile, doraCoordsFile);
  const doraGroups = doraBuild.groups;
  const matches = buildMatchRecords(googleRows, doraGroups);

  const matchedGoogleIds = new Set(matches.map((match) => match.google.id));
  const matchedDoraIds = new Set(matches.map((match) => match.dora.id));

  const googleUnmatchedRows = googleRows
    .filter((row) => !matchedGoogleIds.has(row.id))
    .sort((a, b) => [a.zone_id, a.name, a.address, a.id].join("|").localeCompare([b.zone_id, b.name, b.address, b.id].join("|")));

  const doraUnmatchedRows = doraGroups
    .filter((group) => !matchedDoraIds.has(group.id))
    .flatMap((group) =>
      group.licenses.map((license) => ({
        group_id: group.id,
        address_key: group.address_key,
        street: group.street,
        city: group.city,
        state: group.state,
        zip: group.zip,
        lat: group.lat,
        lon: group.lon,
        coord_source: group.coord_source,
        row_id: license.row_id,
        full_name: license.full_name,
        entity_name: license.entity_name,
        license_type_raw: license.license_type_raw,
        license_status_raw: license.license_status_raw,
        operational_category: license.operational_category,
        raw_profession_label: license.raw_profession_label,
      }))
    )
    .sort((a, b) =>
      [a.address_key, a.row_id, a.full_name].join("|").localeCompare([b.address_key, b.row_id, b.full_name].join("|"))
    );

  const strongMatches = matches.filter((match) => match.match_confidence === "strong").length;
  const likelyMatches = matches.filter((match) => match.match_confidence === "likely").length;
  const weakMatches = matches.filter((match) => match.match_confidence === "weak").length;

  const matchMaster = {
    generated_at: new Date().toISOString(),
    input_google_path: GOOGLE_MEMBERS_PATH,
    input_google_candidates_path: GOOGLE_CANDIDATES_PATH,
    input_dora_roster_path: DORA_ROSTER_PATH,
    input_dora_coords_path: DORA_COORDS_PATH,
    thresholds: {
      min_match_score: MIN_MATCH_SCORE,
      strong_match_score: STRONG_MATCH_SCORE,
      likely_match_score: LIKELY_MATCH_SCORE,
      max_distance_miles: MAX_DISTANCE_MILES,
    },
    counts: {
      google_rows_loaded: googleRows.length,
      dora_address_groups_loaded: doraGroups.length,
      dora_active_licenses_loaded: doraGroups.reduce((sum, group) => sum + group.active_license_count, 0),
      strong_matches: strongMatches,
      likely_matches: likelyMatches,
      weak_matches: weakMatches,
      total_match_records: matches.length,
      matched_google_rows: matchedGoogleIds.size,
      matched_dora_address_groups: matchedDoraIds.size,
      unmatched_google_rows: googleUnmatchedRows.length,
      unmatched_dora_licenses: doraUnmatchedRows.length,
      dora_active_licenses_skipped_without_coords: doraBuild.skippedNoCoords,
    },
    matches,
  };

  const googleUnmatched = {
    generated_at: matchMaster.generated_at,
    input_google_path: GOOGLE_MEMBERS_PATH,
    counts: {
      rows: googleUnmatchedRows.length,
    },
    rows: googleUnmatchedRows.map((row) => ({
      id: row.id,
      location_id: row.location_id,
      zone_id: row.zone_id,
      zone_name: row.zone_name,
      market: row.market,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      lat: row.lat,
      lon: row.lon,
      category: row.category,
      category_raw: row.category_raw,
      category_source_labels_raw: row.category_source_labels_raw,
      google_types_raw: row.google_types_raw,
      subtype: row.subtype,
      phone: row.phone,
      website: row.website,
      website_domain: row.website_domain,
      source: row.source,
    })),
  };

  const doraUnmatched = {
    generated_at: matchMaster.generated_at,
    input_dora_roster_path: DORA_ROSTER_PATH,
    input_dora_coords_path: DORA_COORDS_PATH,
    counts: {
      licenses: doraUnmatchedRows.length,
    },
    rows: doraUnmatchedRows,
  };

  ensureDirForFile(MATCH_MASTER_PATH);
  fs.writeFileSync(MATCH_MASTER_PATH, JSON.stringify(matchMaster, null, 2), "utf8");
  fs.writeFileSync(GOOGLE_UNMATCHED_PATH, JSON.stringify(googleUnmatched, null, 2), "utf8");
  fs.writeFileSync(DORA_UNMATCHED_PATH, JSON.stringify(doraUnmatched, null, 2), "utf8");

  console.log(`Google rows loaded: ${matchMaster.counts.google_rows_loaded}`);
  console.log(`DORA rows loaded: ${matchMaster.counts.dora_active_licenses_loaded}`);
  console.log(`DORA address groups loaded: ${matchMaster.counts.dora_address_groups_loaded}`);
  console.log(`Strong matches: ${matchMaster.counts.strong_matches}`);
  console.log(`Likely matches: ${matchMaster.counts.likely_matches}`);
  console.log(`Weak matches: ${matchMaster.counts.weak_matches}`);
  console.log(`Unmatched Google count: ${matchMaster.counts.unmatched_google_rows}`);
  console.log(`Unmatched DORA count: ${matchMaster.counts.unmatched_dora_licenses}`);
  console.log(`Wrote: ${MATCH_MASTER_PATH}`);
  console.log(`Wrote: ${GOOGLE_UNMATCHED_PATH}`);
  console.log(`Wrote: ${DORA_UNMATCHED_PATH}`);
}

main();
