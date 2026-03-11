import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
  scores: {
    final_match_score: number;
  };
  match_confidence: "strong" | "likely" | "weak";
};

type MatchMasterFile = {
  matches?: MatchRecord[];
};

type GoogleUnmatchedRow = {
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
  phone: string;
  website: string;
  website_domain: string;
  source: string;
};

type GoogleUnmatchedFile = {
  rows?: GoogleUnmatchedRow[];
};

type OnlineIdentityCandidate = {
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

type OnlineIdentityFile = {
  rows?: OnlineIdentityCandidate[];
};

type DoraCoordsFile = {
  rows?: Array<{
    addressKey: string;
    lat: number;
    lon: number;
  }>;
};

type LiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  google_signal_present: boolean;
  dora_signal_present: boolean;
  online_identity_signal_present: boolean;
  signal_mix: "google+dora+online" | "google+dora" | "dora+online" | "google+online" | "google_only" | "dora_only";
  google_place_id: string | null;
  dora_license_id: string | null;
  entity_score: number;
  confidence: "strong" | "likely" | "candidate_review" | "ambiguous";
  live_unit: boolean;
  explanation: string;
  raw_snippets: {
    google?: {
      id: string;
      name: string;
      address: string;
      zone_id: string;
      zone_name: string;
      website_domain: string;
    };
    dora?: {
      address_key: string;
      raw_license_types: string[];
      raw_names: string[];
      license_row_ids: string[];
    };
    online_identity?: {
      search_priority: "high" | "medium" | "low";
      sample_queries: string[];
      candidate_ids: string[];
    };
  };
};

type DedupeOnlineGroup = {
  group_key: string;
  candidate_ids: string[];
  dora_row_ids: string[];
  dora_license_numbers: string[];
  name_display: string;
  operational_category: string;
  city: string;
  state: string;
  zip: string;
  address_key: string;
  has_geocode: boolean;
  has_city_zip: boolean;
  in_target_metro: boolean;
  target_market_context: string[];
  search_priority: "high" | "medium" | "low";
  generated_queries: string[];
  already_google_matched: boolean;
  google_match_context: OnlineIdentityCandidate["google_match_context"];
};

const ROOT = process.cwd();
const MATCH_MASTER_PATH = path.join(ROOT, "data", "markets", "beauty_match_master.v1.json");
const GOOGLE_UNMATCHED_PATH = path.join(ROOT, "data", "markets", "google_unmatched.v1.json");
const ONLINE_CANDIDATES_PATH = path.join(ROOT, "data", "markets", "beauty_online_identity_candidates.v1.json");
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
const OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_live_units.v1.json");
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

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => s(value)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function normalizeText(value: string) {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(...parts: string[]) {
  return crypto
    .createHash("sha1")
    .update(parts.map((part) => s(part)).join("::"))
    .digest("hex")
    .slice(0, 16);
}

function confidenceBucketValue(value: "strong" | "likely" | "weak") {
  return value === "strong" ? 3 : value === "likely" ? 2 : 1;
}

function liveUnitConfidenceScore(value: "strong" | "likely" | "candidate_review" | "ambiguous") {
  return value === "strong" ? 4 : value === "likely" ? 3 : value === "candidate_review" ? 2 : 1;
}

function signalMixForRow(row: Pick<LiveUnitRow, "google_signal_present" | "dora_signal_present" | "online_identity_signal_present">) {
  if (row.google_signal_present && row.dora_signal_present && row.online_identity_signal_present) {
    return "google+dora+online" as const;
  }
  if (row.google_signal_present && row.dora_signal_present) {
    return "google+dora" as const;
  }
  if (row.dora_signal_present && row.online_identity_signal_present) {
    return "dora+online" as const;
  }
  if (row.google_signal_present && row.online_identity_signal_present) {
    return "google+online" as const;
  }
  if (row.google_signal_present) {
    return "google_only" as const;
  }
  return "dora_only" as const;
}

function buildCoordsByAddress(coordsFile: DoraCoordsFile) {
  return new Map(
    (coordsFile.rows || [])
      .map((row) => [s(row.addressKey), { lat: row.lat, lon: row.lon }] as const)
      .filter(([key]) => !!key)
  );
}

function pickSubtype(match: MatchRecord | null, onlineGroup?: DedupeOnlineGroup | null) {
  if (match?.google?.subtype) return match.google.subtype;
  if (onlineGroup?.google_match_context?.some((item) => item.subtype === "suite")) return "suite";
  return "unknown";
}

function selectMatchedPairs(matches: MatchRecord[]) {
  const sorted = matches
    .slice()
    .sort((a, b) => {
      if (b.scores.final_match_score !== a.scores.final_match_score) {
        return b.scores.final_match_score - a.scores.final_match_score;
      }
      if (confidenceBucketValue(b.match_confidence) !== confidenceBucketValue(a.match_confidence)) {
        return confidenceBucketValue(b.match_confidence) - confidenceBucketValue(a.match_confidence);
      }
      return [a.google.id, a.dora.id, a.match_id].join("|").localeCompare([b.google.id, b.dora.id, b.match_id].join("|"));
    });

  const selected: MatchRecord[] = [];
  const usedGoogle = new Set<string>();
  const usedDora = new Set<string>();
  const candidateMapByGoogle = new Map<string, MatchRecord[]>();
  const candidateMapByDora = new Map<string, MatchRecord[]>();

  for (const match of sorted) {
    const byGoogle = candidateMapByGoogle.get(match.google.id) || [];
    byGoogle.push(match);
    candidateMapByGoogle.set(match.google.id, byGoogle);

    const byDora = candidateMapByDora.get(match.dora.id) || [];
    byDora.push(match);
    candidateMapByDora.set(match.dora.id, byDora);

    if (usedGoogle.has(match.google.id) || usedDora.has(match.dora.id)) continue;
    selected.push(match);
    usedGoogle.add(match.google.id);
    usedDora.add(match.dora.id);
  }

  return { selected, candidateMapByGoogle, candidateMapByDora, usedGoogle, usedDora };
}

function buildOnlineGroups(rows: OnlineIdentityCandidate[]) {
  const groups = new Map<string, DedupeOnlineGroup>();

  const priorityValue = (priority: "high" | "medium" | "low") =>
    priority === "high" ? 3 : priority === "medium" ? 2 : 1;

  for (const row of rows) {
    const dedupeKey =
      s(row.dora_license_number) ||
      [s(row.dora_full_name).toLowerCase(), s(row.address_key), s(row.operational_category)].join("|");
    const existing = groups.get(dedupeKey);
    if (!existing) {
      groups.set(dedupeKey, {
        group_key: dedupeKey,
        candidate_ids: [row.candidate_id],
        dora_row_ids: uniqueSorted([row.dora_row_id]),
        dora_license_numbers: uniqueSorted([row.dora_license_number]),
        name_display: row.dora_full_name,
        operational_category: row.operational_category,
        city: row.city,
        state: row.state,
        zip: row.zip,
        address_key: row.address_key,
        has_geocode: row.has_geocode,
        has_city_zip: row.has_city_zip,
        in_target_metro: row.in_target_metro,
        target_market_context: uniqueSorted(row.target_market_context),
        search_priority: row.search_priority,
        generated_queries: uniqueSorted(row.generated_queries),
        already_google_matched: row.already_google_matched,
        google_match_context: row.google_match_context.slice(),
      });
      continue;
    }

    existing.candidate_ids = uniqueSorted([...existing.candidate_ids, row.candidate_id]);
    existing.dora_row_ids = uniqueSorted([...existing.dora_row_ids, row.dora_row_id]);
    existing.dora_license_numbers = uniqueSorted([...existing.dora_license_numbers, row.dora_license_number]);
    existing.has_geocode = existing.has_geocode || row.has_geocode;
    existing.has_city_zip = existing.has_city_zip || row.has_city_zip;
    existing.in_target_metro = existing.in_target_metro || row.in_target_metro;
    existing.target_market_context = uniqueSorted([...existing.target_market_context, ...row.target_market_context]);
    existing.generated_queries = uniqueSorted([...existing.generated_queries, ...row.generated_queries]);
    existing.already_google_matched = existing.already_google_matched || row.already_google_matched;
    existing.google_match_context = existing.google_match_context
      .concat(row.google_match_context)
      .sort((a, b) =>
        [a.google_name, a.zone_id, a.google_id].join("|").localeCompare([b.google_name, b.zone_id, b.google_id].join("|"))
      );
    if (priorityValue(row.search_priority) > priorityValue(existing.search_priority)) {
      existing.search_priority = row.search_priority;
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    [
      a.search_priority,
      a.city,
      a.zip,
      a.operational_category,
      a.name_display,
      a.group_key,
    ].join("|").localeCompare([
      b.search_priority,
      b.city,
      b.zip,
      b.operational_category,
      b.name_display,
      b.group_key,
    ].join("|"))
  );
}

function buildNameMultiplicity(groups: DedupeOnlineGroup[]) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    const key = s(group.name_display).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function explanationForMatched(match: MatchRecord, onlineGroup: DedupeOnlineGroup | null, confidence: LiveUnitRow["confidence"]) {
  const category = s(match.google.category) || s(Object.keys(match.dora.operational_mix || {}).find((key) => (match.dora.operational_mix as Record<string, number>)[key] > 0));
  const parts = [
    "Google place",
    `active DORA ${category || "beauty"} signal`,
  ];
  if (onlineGroup) parts.push("online identity candidate");
  if (confidence === "ambiguous") parts.push("multiple plausible pairings");
  return parts.join(" + ");
}

function explanationForOnline(group: DedupeOnlineGroup, confidence: LiveUnitRow["confidence"]) {
  if (confidence === "likely") {
    return `Active DORA ${group.operational_category} + online identity candidate with geocode and target-metro support`;
  }
  if (confidence === "ambiguous") {
    return `Active DORA ${group.operational_category} + online identity candidate with multiple plausible operator/address pairings`;
  }
  return `Active DORA ${group.operational_category} + online identity candidate; no direct Google place match`;
}

function explanationForGoogleOnly(row: GoogleUnmatchedRow) {
  return `Google-visible ${row.category} business with no usable DORA support yet`;
}

function hasDistinctiveName(name: string) {
  const tokens = normalizeText(name).split(" ").filter(Boolean);
  if (tokens.length < 2) return false;
  const lastToken = tokens[tokens.length - 1] || "";
  return normalizeText(name).length >= 12 && lastToken.length >= 4;
}

function main() {
  const matchMaster = readJsonFile<MatchMasterFile>(MATCH_MASTER_PATH);
  const googleUnmatchedFile = readJsonFile<GoogleUnmatchedFile>(GOOGLE_UNMATCHED_PATH);
  const onlineIdentityFile = readJsonFile<OnlineIdentityFile>(ONLINE_CANDIDATES_PATH);
  const doraCoordsFile = readJsonFile<DoraCoordsFile>(DORA_COORDS_PATH);
  const coordsByAddress = buildCoordsByAddress(doraCoordsFile);

  const { selected, candidateMapByGoogle, candidateMapByDora, usedGoogle, usedDora } = selectMatchedPairs(
    matchMaster.matches || []
  );
  const onlineGroups = buildOnlineGroups(onlineIdentityFile.rows || []);
  const onlineGroupByRowId = new Map<string, DedupeOnlineGroup[]>();
  const nameMultiplicity = buildNameMultiplicity(onlineGroups);

  for (const group of onlineGroups) {
    for (const rowId of group.dora_row_ids) {
      const list = onlineGroupByRowId.get(rowId) || [];
      list.push(group);
      onlineGroupByRowId.set(rowId, list);
    }
  }

  const liveUnits: LiveUnitRow[] = [];

  for (const match of selected) {
    const relatedOnlineGroups = uniqueSorted(match.dora.license_row_ids)
      .flatMap((rowId) => onlineGroupByRowId.get(rowId) || []);
    const onlineGroup =
      relatedOnlineGroups
        .slice()
        .sort((a, b) =>
          [a.name_display, a.group_key].join("|").localeCompare([b.name_display, b.group_key].join("|"))
        )[0] || null;
    const candidateCountForGoogle = candidateMapByGoogle.get(match.google.id)?.length || 0;
    const candidateCountForDora = candidateMapByDora.get(match.dora.id)?.length || 0;

    let confidence: LiveUnitRow["confidence"];
    if (match.match_confidence === "strong") confidence = "strong";
    else if (match.match_confidence === "likely") confidence = "likely";
    else if (candidateCountForGoogle > 1 || candidateCountForDora > 1) confidence = "ambiguous";
    else confidence = "candidate_review";

    const liveUnit: LiveUnitRow = {
      live_unit_id: stableId("live", match.google.id, match.dora.id),
      name_display: match.google.name,
      operational_category: match.google.category,
      subtype: pickSubtype(match, onlineGroup),
      city: match.google.city,
      state: match.google.state,
      zip: match.google.zip,
      lat: match.google.lat,
      lon: match.google.lon,
      google_signal_present: true,
      dora_signal_present: true,
      online_identity_signal_present: !!onlineGroup,
      signal_mix: signalMixForRow({
        google_signal_present: true,
        dora_signal_present: true,
        online_identity_signal_present: !!onlineGroup,
      }),
      google_place_id: match.google.chosen_place_id || match.google.top_place_id || null,
      dora_license_id: match.dora.license_row_ids[0] || null,
      entity_score: match.scores.final_match_score,
      confidence,
      live_unit: confidence === "strong" || confidence === "likely",
      explanation: explanationForMatched(match, onlineGroup, confidence),
      raw_snippets: {
        google: {
          id: match.google.id,
          name: match.google.name,
          address: match.google.address,
          zone_id: match.google.zone_id,
          zone_name: match.google.zone_name,
          website_domain: match.google.website_domain,
        },
        dora: {
          address_key: match.dora.address_key,
          raw_license_types: match.dora.raw_license_types,
          raw_names: match.dora.raw_names.slice(0, 5),
          license_row_ids: match.dora.license_row_ids,
        },
        online_identity: onlineGroup
          ? {
              search_priority: onlineGroup.search_priority,
              sample_queries: onlineGroup.generated_queries.slice(0, 5),
              candidate_ids: onlineGroup.candidate_ids.slice(0, 5),
            }
          : undefined,
      },
    };

    liveUnits.push(liveUnit);
  }

  for (const row of googleUnmatchedFile.rows || []) {
    if (usedGoogle.has(row.id)) continue;
    liveUnits.push({
      live_unit_id: stableId("google-only", row.id),
      name_display: row.name,
      operational_category: row.category,
      subtype: row.subtype || "unknown",
      city: row.city,
      state: row.state,
      zip: row.zip,
      lat: row.lat,
      lon: row.lon,
      google_signal_present: true,
      dora_signal_present: false,
      online_identity_signal_present: false,
      signal_mix: "google_only",
      google_place_id: null,
      dora_license_id: null,
      entity_score: 35,
      confidence: "candidate_review",
      live_unit: false,
      explanation: explanationForGoogleOnly(row),
      raw_snippets: {
        google: {
          id: row.id,
          name: row.name,
          address: row.address,
          zone_id: row.zone_id,
          zone_name: row.zone_name,
          website_domain: row.website_domain,
        },
      },
    });
  }

  for (const group of onlineGroups) {
    const isAlreadyCovered = group.dora_row_ids.some((rowId) =>
      selected.some((match) => match.dora.license_row_ids.includes(rowId))
    );
    if (isAlreadyCovered) continue;
    if (group.search_priority === "low") continue;

    const nameKey = s(group.name_display).toLowerCase();
    let confidence: LiveUnitRow["confidence"];
    if ((nameMultiplicity.get(nameKey) || 0) > 1) confidence = "ambiguous";
    else if (
      group.search_priority === "high" &&
      group.has_geocode &&
      group.has_city_zip &&
      group.in_target_metro &&
      HIGH_VALUE_CATEGORIES.has(group.operational_category) &&
      hasDistinctiveName(group.name_display)
    ) {
      confidence = "likely";
    }
    else confidence = "candidate_review";

    const liveUnit = confidence === "likely";
    const primaryGoogleContext = group.google_match_context[0];
    const doraCoords = coordsByAddress.get(group.address_key);

    liveUnits.push({
      live_unit_id: stableId("dora-online", group.group_key),
      name_display: group.name_display,
      operational_category: group.operational_category,
      subtype: primaryGoogleContext?.subtype || "unknown",
      city: group.city,
      state: group.state,
      zip: group.zip,
      lat: doraCoords?.lat ?? null,
      lon: doraCoords?.lon ?? null,
      google_signal_present: false,
      dora_signal_present: true,
      online_identity_signal_present: true,
      signal_mix: "dora+online",
      google_place_id: null,
      dora_license_id: group.dora_license_numbers[0] || group.dora_row_ids[0] || null,
      entity_score: confidence === "likely" ? 72 : confidence === "ambiguous" ? 58 : 48,
      confidence,
      live_unit: liveUnit,
      explanation: explanationForOnline(group, confidence),
      raw_snippets: {
        dora: {
          address_key: group.address_key,
          raw_license_types: [],
          raw_names: [group.name_display],
          license_row_ids: group.dora_row_ids,
        },
        online_identity: {
          search_priority: group.search_priority,
          sample_queries: group.generated_queries.slice(0, 5),
          candidate_ids: group.candidate_ids.slice(0, 5),
        },
      },
    });
  }

  liveUnits.sort((a, b) => {
    if (liveUnitConfidenceScore(b.confidence) !== liveUnitConfidenceScore(a.confidence)) {
      return liveUnitConfidenceScore(b.confidence) - liveUnitConfidenceScore(a.confidence);
    }
    if (b.entity_score !== a.entity_score) return b.entity_score - a.entity_score;
    return [a.city, a.zip, a.operational_category, a.name_display, a.live_unit_id]
      .join("|")
      .localeCompare([b.city, b.zip, b.operational_category, b.name_display, b.live_unit_id].join("|"));
  });

  const countsBySignalMix = liveUnits.reduce<Record<string, number>>((acc, row) => {
    acc[row.signal_mix] = (acc[row.signal_mix] || 0) + 1;
    return acc;
  }, {});

  const output = {
    generated_at: new Date().toISOString(),
    input_paths: {
      match_master: MATCH_MASTER_PATH,
      google_unmatched: GOOGLE_UNMATCHED_PATH,
      online_identity_candidates: ONLINE_CANDIDATES_PATH,
      dora_coords: DORA_COORDS_PATH,
    },
    counts: {
      total_live_units_written: liveUnits.length,
      strong: liveUnits.filter((row) => row.confidence === "strong").length,
      likely: liveUnits.filter((row) => row.confidence === "likely").length,
      candidate_review: liveUnits.filter((row) => row.confidence === "candidate_review").length,
      ambiguous: liveUnits.filter((row) => row.confidence === "ambiguous").length,
      signal_mix: {
        google_dora_online: countsBySignalMix["google+dora+online"] || 0,
        google_dora: countsBySignalMix["google+dora"] || 0,
        dora_online: countsBySignalMix["dora+online"] || 0,
        google_online: countsBySignalMix["google+online"] || 0,
        google_only: countsBySignalMix["google_only"] || 0,
        dora_only: countsBySignalMix["dora_only"] || 0,
      },
    },
    rows: liveUnits,
  };

  ensureDirForFile(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Total live units written: ${output.counts.total_live_units_written}`);
  console.log(`Strong count: ${output.counts.strong}`);
  console.log(`Likely count: ${output.counts.likely}`);
  console.log(`Candidate review count: ${output.counts.candidate_review}`);
  console.log(`Ambiguous count: ${output.counts.ambiguous}`);
  console.log(`Google + DORA + online: ${output.counts.signal_mix.google_dora_online}`);
  console.log(`Google + DORA: ${output.counts.signal_mix.google_dora}`);
  console.log(`DORA + online: ${output.counts.signal_mix.dora_online}`);
  console.log(`Google + online: ${output.counts.signal_mix.google_online}`);
  console.log(`Google only: ${output.counts.signal_mix.google_only}`);
  console.log(`DORA only: ${output.counts.signal_mix.dora_only}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
