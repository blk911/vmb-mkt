import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type DoraRosterRow = {
  rowId?: string;
  fullName?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressKey?: string;
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

type MatchRecord = {
  match_confidence: "strong" | "likely" | "weak";
  google: {
    id: string;
    location_id: string;
    zone_id: string;
    zone_name: string;
    market: string;
    name: string;
    category: string;
    subtype: string;
    website?: string;
    website_domain?: string;
  };
  dora: {
    id: string;
    address_key: string;
    address_key_base: string;
    license_row_ids: string[];
    raw_license_types: string[];
    raw_names: string[];
  };
  scores: {
    final_match_score: number;
  };
};

type MatchMasterFile = {
  matches?: MatchRecord[];
};

type BeautyZoneMember = {
  zone_id: string;
  zone_name: string;
  market: string;
  city: string;
  zip: string;
};

type CandidateRow = {
  candidate_id: string;
  dora_row_id: string;
  dora_license_number: string;
  dora_full_name: string;
  dora_first_name: string;
  dora_last_name: string;
  dora_raw_profession: string;
  dora_license_status: string;
  operational_category: string;
  profession_keywords: string[];
  city: string;
  state: string;
  zip: string;
  address_key: string;
  has_geocode: boolean;
  has_city_zip: boolean;
  in_target_metro: boolean;
  target_market_context: string[];
  already_google_matched: boolean;
  google_match_context: Array<{
    confidence: "strong" | "likely" | "weak";
    match_score: number;
    google_id: string;
    google_name: string;
    zone_id: string;
    zone_name: string;
    market: string;
    category: string;
    subtype: string;
    website_domain?: string;
  }>;
  search_priority: "high" | "medium" | "low";
  generated_queries: string[];
};

const ROOT = process.cwd();
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
const MEMBERS_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");
const OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_online_identity_candidates.v1.json");

const HIGH_VALUE_CATEGORIES = new Set(["hair", "nail", "esthe", "barber"]);

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function s(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(value: string) {
  return s(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZip(value: string) {
  return s(value).replace(/[^0-9]/g, "").slice(0, 5);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => s(value)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function stableId(...parts: string[]) {
  return crypto
    .createHash("sha1")
    .update(parts.map((part) => s(part)).join("::"))
    .digest("hex")
    .slice(0, 16);
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

function professionKeywordsForCategory(category: string) {
  switch (category) {
    case "nail":
      return ["nail", "nail tech", "manicurist"];
    case "hair":
      return ["hair", "cosmetology", "hairstylist"];
    case "esthe":
      return ["esthetician", "lashes", "brows", "waxing"];
    case "barber":
      return ["barber"];
    case "spa":
      return ["spa"];
    case "beauty":
      return ["beauty"];
    default:
      return ["beauty"];
  }
}

function splitName(fullName: string) {
  const cleaned = s(fullName)
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return {
    full: cleaned,
    first: parts[0] || "",
    last: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

function buildTargetMetroContext(membersFile: { members?: BeautyZoneMember[] }) {
  const citySet = new Set<string>();
  const zipSet = new Set<string>();
  const cityToMarkets = new Map<string, Set<string>>();

  for (const member of membersFile.members || []) {
    const city = normalizeText(member.city);
    const zip = normalizeZip(member.zip);
    if (city) {
      citySet.add(city);
      if (!cityToMarkets.has(city)) cityToMarkets.set(city, new Set<string>());
      cityToMarkets.get(city)?.add(`${s(member.market)} (${s(member.zone_id)})`);
    }
    if (zip) zipSet.add(zip);
  }

  return {
    citySet,
    zipSet,
    cityToMarkets,
  };
}

function buildStrongMatchIndex(matchMaster: MatchMasterFile) {
  const byRowId = new Map<string, CandidateRow["google_match_context"]>();
  const byAddressKey = new Map<string, CandidateRow["google_match_context"]>();

  for (const match of matchMaster.matches || []) {
    if (match.match_confidence !== "strong") continue;
    const context = {
      confidence: match.match_confidence,
      match_score: Number(match.scores?.final_match_score || 0),
      google_id: s(match.google?.id),
      google_name: s(match.google?.name),
      zone_id: s(match.google?.zone_id),
      zone_name: s(match.google?.zone_name),
      market: s(match.google?.market),
      category: s(match.google?.category),
      subtype: s(match.google?.subtype),
      website_domain: s(match.google?.website_domain) || undefined,
    };

    for (const rowId of match.dora?.license_row_ids || []) {
      const list = byRowId.get(s(rowId)) || [];
      list.push(context);
      byRowId.set(s(rowId), list);
    }

    const addressKey = s(match.dora?.address_key);
    if (addressKey) {
      const list = byAddressKey.get(addressKey) || [];
      list.push(context);
      byAddressKey.set(addressKey, list);
    }
  }

  const normalize = (items: CandidateRow["google_match_context"]) =>
    items
      .slice()
      .sort((a, b) =>
        [a.google_name, a.zone_id, a.google_id].join("|").localeCompare([b.google_name, b.zone_id, b.google_id].join("|"))
      );

  return {
    byRowId: new Map(Array.from(byRowId.entries()).map(([key, value]) => [key, normalize(value)])),
    byAddressKey: new Map(Array.from(byAddressKey.entries()).map(([key, value]) => [key, normalize(value)])),
  };
}

function buildGeocodeSet(coordsFile: DoraCoordsFile) {
  return new Set((coordsFile.rows || []).map((row) => s(row.addressKey)).filter(Boolean));
}

function buildQueries(name: ReturnType<typeof splitName>, category: string, city: string, zip: string) {
  const full = name.full;
  const firstLast = [name.first, name.last].filter(Boolean).join(" ");
  const keywords = professionKeywordsForCategory(category);
  const queries: string[] = [];

  const add = (...parts: Array<string | undefined>) => {
    const query = parts.map((part) => s(part)).filter(Boolean).join(" ").trim();
    if (query) queries.push(query);
  };

  add(`"${full}"`, keywords[0]);
  if (firstLast && firstLast !== full) add(`"${firstLast}"`, keywords[0]);
  add(`"${full}"`, city);
  add(`"${full}"`, zip);
  add(`"${full}"`, keywords[0], city);
  add(`"${full}"`, keywords[0], zip);

  for (const keyword of keywords.slice(1)) {
    add(`"${full}"`, keyword);
    add(`"${full}"`, keyword, city);
  }

  if (category === "esthe") {
    add(`"${full}"`, "esthetician", city);
    add(`"${full}"`, "lashes", city);
  }

  return uniqueSorted(queries);
}

function determinePriority(params: {
  category: string;
  alreadyGoogleMatched: boolean;
  hasGeocode: boolean;
  hasCityZip: boolean;
  inTargetMetro: boolean;
}) {
  if (!params.alreadyGoogleMatched && params.inTargetMetro && HIGH_VALUE_CATEGORIES.has(params.category)) {
    return "high" as const;
  }
  if (!params.alreadyGoogleMatched && params.hasGeocode && params.hasCityZip) {
    return "medium" as const;
  }
  if (!params.alreadyGoogleMatched && params.inTargetMetro) {
    return "medium" as const;
  }
  return "low" as const;
}

function main() {
  const rosterFile = readJsonFile<{ byAddressKey?: Record<string, DoraRosterRow[]> }>(DORA_ROSTER_PATH);
  const coordsFile = readJsonFile<DoraCoordsFile>(DORA_COORDS_PATH);
  const matchMaster = readJsonFile<MatchMasterFile>(MATCH_MASTER_PATH);
  const membersFile = readJsonFile<{ members?: BeautyZoneMember[] }>(MEMBERS_PATH);

  const geocodeSet = buildGeocodeSet(coordsFile);
  const strongMatchIndex = buildStrongMatchIndex(matchMaster);
  const metroContext = buildTargetMetroContext(membersFile);

  const candidateRows: CandidateRow[] = [];
  let totalRowsConsidered = 0;
  let totalGeneratedQueries = 0;

  for (const addressKey of Object.keys(rosterFile.byAddressKey || {}).sort((a, b) => a.localeCompare(b))) {
    const rows = rosterFile.byAddressKey?.[addressKey] || [];
    for (const row of rows) {
      const licenseStatus = s(row.licenseStatus).toUpperCase();
      if (!licenseStatus.includes("ACTIVE")) continue;

      const classification = classifyLicenseType(s(row.licenseType));
      if (classification.category === "other") continue;

      totalRowsConsidered += 1;

      const name = splitName(s(row.fullName) || s(row.raw?.["Formatted Name"]));
      if (!name.full) continue;

      const city = s(row.city) || s(row.raw?.["City"]);
      const zip = normalizeZip(s(row.zip) || s(row.raw?.["Mail Zip Code"]));
      const state = s(row.state) || s(row.raw?.["State"]);
      const rowId = s(row.rowId);
      const addressKeyValue = s(row.addressKey) || s(addressKey);
      const strongMatches =
        strongMatchIndex.byRowId.get(rowId) ||
        strongMatchIndex.byAddressKey.get(addressKeyValue) ||
        [];
      const alreadyGoogleMatched = strongMatches.length > 0;
      const hasGeocode = geocodeSet.has(addressKeyValue);
      const hasCityZip = !!city && !!zip;
      const cityKey = normalizeText(city);
      const inTargetMetro = metroContext.citySet.has(cityKey) || (hasGeocode && metroContext.zipSet.has(zip));
      const targetMarketContext = uniqueSorted(Array.from(metroContext.cityToMarkets.get(cityKey) || []));
      const queries = buildQueries(name, classification.category, city, zip);
      const searchPriority = determinePriority({
        category: classification.category,
        alreadyGoogleMatched,
        hasGeocode,
        hasCityZip,
        inTargetMetro,
      });

      totalGeneratedQueries += queries.length;

      candidateRows.push({
        candidate_id: stableId(rowId || addressKeyValue, name.full, classification.rawLabel),
        dora_row_id: rowId,
        dora_license_number: s(row.raw?.["License Number"]),
        dora_full_name: name.full,
        dora_first_name: name.first,
        dora_last_name: name.last,
        dora_raw_profession: classification.rawLabel,
        dora_license_status: s(row.licenseStatus),
        operational_category: classification.category,
        profession_keywords: professionKeywordsForCategory(classification.category),
        city,
        state,
        zip,
        address_key: addressKeyValue,
        has_geocode: hasGeocode,
        has_city_zip: hasCityZip,
        in_target_metro: inTargetMetro,
        target_market_context: targetMarketContext,
        already_google_matched: alreadyGoogleMatched,
        google_match_context: strongMatches,
        search_priority: searchPriority,
        generated_queries: queries,
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  candidateRows.sort((a, b) => {
    if (priorityOrder[a.search_priority] !== priorityOrder[b.search_priority]) {
      return priorityOrder[a.search_priority] - priorityOrder[b.search_priority];
    }
    return [
      a.city,
      a.zip,
      a.operational_category,
      a.dora_full_name,
      a.dora_row_id,
    ].join("|").localeCompare([
      b.city,
      b.zip,
      b.operational_category,
      b.dora_full_name,
      b.dora_row_id,
    ].join("|"));
  });

  const output = {
    generated_at: new Date().toISOString(),
    input_dora_roster_path: DORA_ROSTER_PATH,
    input_dora_coords_path: DORA_COORDS_PATH,
    input_google_match_path: MATCH_MASTER_PATH,
    counts: {
      total_dora_rows_considered: totalRowsConsidered,
      total_candidate_rows_written: candidateRows.length,
      total_generated_query_strings: totalGeneratedQueries,
      rows_already_strongly_matched_to_google: candidateRows.filter((row) => row.already_google_matched).length,
      rows_prioritized_for_review_search: candidateRows.filter((row) => row.search_priority !== "low").length,
      high_priority_rows: candidateRows.filter((row) => row.search_priority === "high").length,
      medium_priority_rows: candidateRows.filter((row) => row.search_priority === "medium").length,
      low_priority_rows: candidateRows.filter((row) => row.search_priority === "low").length,
    },
    rows: candidateRows,
  };

  ensureDirForFile(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Total DORA rows considered: ${output.counts.total_dora_rows_considered}`);
  console.log(`Total candidate rows written: ${output.counts.total_candidate_rows_written}`);
  console.log(`Total generated query strings: ${output.counts.total_generated_query_strings}`);
  console.log(`Rows already strongly matched to Google: ${output.counts.rows_already_strongly_matched_to_google}`);
  console.log(`Rows prioritized for review/search: ${output.counts.rows_prioritized_for_review_search}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
