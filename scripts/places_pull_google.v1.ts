import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type AnyObj = Record<string, any>;

type BeautyZone = {
  zone_id: string;
  zone_name: string;
  region_id?: string;
  market: string;
  center_lat: number;
  center_lon: number;
  radius_miles: number;
  status: string;
  notes?: string;
};

type SearchAccumulator = {
  placeId: string;
  zones: Set<string>;
  queries: Set<string>;
  nearby: AnyObj;
};

const ZONES_REL = "data/markets/beauty_zones.json";
const OUT_REL = "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";
const RAW_REL = "data/co/dora/denver_metro/places/raw/places_zone_sweep.v1.json";
const DETAILS_DELAY_MS = Number(process.env.VMB_PLACES_DETAILS_DELAY_MS || "40") || 40;
const NEXT_PAGE_DELAY_MS = Number(process.env.VMB_PLACES_NEXT_PAGE_DELAY_MS || "2200") || 2200;
const REQUEST_TIMEOUT_MS = Number(process.env.VMB_PLACES_REQUEST_TIMEOUT_MS || "20000") || 20000;
const TARGET_REGION_ID = String(process.env.VMB_PLACES_REGION_ID || "DEN").trim();
const SEARCH_QUERIES = [
  "nail salon",
  "hair salon",
  "hair stylist",
  "beauty salon",
  "spa",
  "day spa",
  "eyebrow bar",
  "lash studio",
  "barber shop",
  "salon suites",
  "beauty suites",
];

function repoAbs(rel: string) {
  return path.resolve(process.cwd(), rel);
}

function ensureDirForFile(rel: string) {
  const abs = repoAbs(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function s(v: any) {
  return String(v ?? "").trim();
}

function n(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readJson(rel: string): AnyObj {
  const abs = repoAbs(rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing JSON: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function milesToMeters(miles: number) {
  return Math.round(miles * 1609.34);
}

function makeAddressKey(street: string, city: string, state: string, zip: string) {
  return [street, city, state, zip].map((part) => s(part).toUpperCase()).join(" | ");
}

function parseAddressComponents(details: AnyObj) {
  const components = Array.isArray(details?.address_components) ? details.address_components : [];
  const byType = (type: string) =>
    components.find((component: AnyObj) => Array.isArray(component?.types) && component.types.includes(type));

  const streetNumber = s(byType("street_number")?.long_name);
  const route = s(byType("route")?.long_name);
  const subpremise = s(byType("subpremise")?.long_name);
  const city =
    s(byType("locality")?.long_name) ||
    s(byType("postal_town")?.long_name) ||
    s(byType("administrative_area_level_2")?.long_name);
  const state = s(byType("administrative_area_level_1")?.short_name);
  const zip = s(byType("postal_code")?.long_name);
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const streetWithUnit = subpremise ? `${street} ${subpremise}`.trim() : street;

  return {
    street: streetWithUnit,
    city,
    state,
    zip,
  };
}

async function googleNearbySearch(
  apiKey: string,
  zone: BeautyZone,
  query: string,
  pageToken?: string
) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("location", `${zone.center_lat},${zone.center_lon}`);
  url.searchParams.set("radius", String(milesToMeters(zone.radius_miles * 1.5)));
  url.searchParams.set("keyword", query);
  if (pageToken) url.searchParams.set("pagetoken", pageToken);

  const res = await fetchWithTimeout(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Nearby search failed for ${zone.zone_id}/${query}: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function googlePlaceDetails(apiKey: string, placeId: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "address_component",
      "geometry",
      "website",
      "formatted_phone_number",
      "url",
      "types",
    ].join(",")
  );
  url.searchParams.set("place_id", placeId);

  const res = await fetchWithTimeout(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Place details failed for ${placeId}: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

function computeMatchScore(name: string, types: string[], queries: string[], hasWebsite: boolean, hasPhone: boolean) {
  const hay = `${name} ${types.join(" ")} ${queries.join(" ")}`.toLowerCase();
  let score = 0;

  if (types.includes("beauty_salon")) score += 25;
  if (types.includes("hair_care")) score += 18;
  if (types.includes("spa")) score += 16;
  if (types.includes("nail_salon")) score += 22;
  if (types.includes("barber_shop")) score += 16;

  if (hay.includes("nail")) score += 18;
  if (hay.includes("hair")) score += 12;
  if (hay.includes("salon")) score += 8;
  if (hay.includes("spa")) score += 12;
  if (hay.includes("lashes") || hay.includes("lash")) score += 10;
  if (hay.includes("brow")) score += 10;
  if (hay.includes("barber")) score += 10;
  if (hay.includes("beauty")) score += 8;
  if (hay.includes("studio")) score += 4;

  if (hasWebsite) score += 6;
  if (hasPhone) score += 4;

  score += Math.min(queries.length, 5) * 4;

  return Math.min(score, 100);
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function looksBeautyRelated(name: string, types: string[], queries: string[]) {
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const hay = `${name} ${normalizedTypes.join(" ")} ${queries.join(" ")}`.toLowerCase();

  if (normalizedTypes.includes("beauty_salon")) return true;
  if (normalizedTypes.includes("hair_care")) return true;
  if (normalizedTypes.includes("spa")) return true;
  if (normalizedTypes.includes("nail_salon")) return true;
  if (normalizedTypes.includes("barber_shop")) return true;

  return [
    "nail",
    "hair",
    "salon",
    "spa",
    "lashes",
    "lash",
    "brow",
    "barber",
    "beauty",
    "studio",
    "lofts",
    "suites",
    "studios",
    "salon lofts",
    "phenix",
    "sola",
    "image studios",
  ].some((token) => hay.includes(token));
}

async function main() {
  const apiKey = s(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY");

  ensureDirForFile(OUT_REL);
  ensureDirForFile(RAW_REL);

  const zonesJson = readJson(ZONES_REL);
  const zones: BeautyZone[] = (Array.isArray(zonesJson?.zones) ? zonesJson.zones : []).filter((zone: BeautyZone) => {
    if (!TARGET_REGION_ID) return true;
    return s(zone.region_id).toUpperCase() === TARGET_REGION_ID || s(zone.status).toLowerCase() === "target";
  });

  const candidatesByPlaceId = new Map<string, SearchAccumulator>();
  const requestLog: AnyObj[] = [];

  for (const zone of zones) {
    for (const query of SEARCH_QUERIES) {
      console.log(`SEARCH ${zone.zone_id} :: ${query}`);
      let pageToken = "";
      let page = 0;

      do {
        if (pageToken) await sleep(NEXT_PAGE_DELAY_MS);
        const json = await googleNearbySearch(apiKey, zone, query, pageToken || undefined);
        page += 1;
        requestLog.push({
          zone_id: zone.zone_id,
          query,
          page,
          status: s(json?.status),
          resultCount: Array.isArray(json?.results) ? json.results.length : 0,
        });
        console.log(`  page ${page}: ${s(json?.status)} (${Array.isArray(json?.results) ? json.results.length : 0} results)`);

        const results: AnyObj[] = Array.isArray(json?.results) ? json.results : [];
        for (const result of results) {
          const placeId = s(result?.place_id);
          if (!placeId) continue;
          const types = Array.isArray(result?.types) ? result.types.map(String) : [];
          const name = s(result?.name);
          if (!looksBeautyRelated(name, types, [query])) continue;

          const existing = candidatesByPlaceId.get(placeId) ?? {
            placeId,
            zones: new Set<string>(),
            queries: new Set<string>(),
            nearby: result,
          };

          existing.zones.add(zone.zone_id);
          existing.queries.add(query);
          if (!existing.nearby?.rating && result?.rating) existing.nearby = result;
          candidatesByPlaceId.set(placeId, existing);
        }

        pageToken = s(json?.next_page_token);
      } while (pageToken && page < 3);
    }
  }

  const rows: AnyObj[] = [];
  for (const [placeId, acc] of Array.from(candidatesByPlaceId.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`DETAILS ${rows.length + 1}/${candidatesByPlaceId.size} :: ${placeId}`);
    const detailsJson = await googlePlaceDetails(apiKey, placeId);
    const result = detailsJson?.result ?? {};
    const nearby = acc.nearby ?? {};
    const types = Array.isArray(result?.types) ? result.types.map(String) : Array.isArray(nearby?.types) ? nearby.types.map(String) : [];
    const name = s(result?.name || nearby?.name);
    const queries = Array.from(acc.queries.values()).sort();
    if (!looksBeautyRelated(name, types, queries)) continue;
    const formattedAddress = s(result?.formatted_address || nearby?.vicinity);
    const website = s(result?.website);
    const phone = s(result?.formatted_phone_number);
    const url = s(result?.url);
    const geometry = result?.geometry?.location ?? nearby?.geometry?.location ?? null;
    const lat = n(geometry?.lat);
    const lon = n(geometry?.lng);
    const parts = parseAddressComponents(result);
    const street = parts.street || formattedAddress.split(",")[0] || name;
    const city = parts.city || s(formattedAddress.split(",")[1]);
    const state = parts.state || "";
    const zipMatch = formattedAddress.match(/\b\d{5}(?:-\d{4})?\b/);
    const zip = parts.zip || s(zipMatch?.[0]);
    const addressKey = makeAddressKey(street, city, state, zip);
    rows.push({
      addressKey,
      address: street,
      city,
      state,
      zip,
      query: queries.join(" | "),
      topPlaceId: placeId,
      chosenPlaceId: placeId,
      chosenMode: "nearby_zone_query",
      chosenReason: `deduped across ${acc.zones.size} zone hits and ${queries.length} query hits`,
      detailsStatus: s(detailsJson?.status || "OK"),
      candidate: {
        placeName: name,
        formattedAddress,
        address: formattedAddress,
        website,
        phone,
        url,
        types,
        matchScore: computeMatchScore(name, types, queries, Boolean(website), Boolean(phone)),
        lat,
        lon,
        source: "google_nearby_zone_sweep_v1",
      },
      lat,
      lon,
      matchedZones: Array.from(acc.zones.values()).sort(),
      matchedQueries: queries,
    });

    await sleep(DETAILS_DELAY_MS);
  }

  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    source: "google_nearby_zone_sweep_v1",
    counts: {
      zones: zones.length,
      queriesPerZone: SEARCH_QUERIES.length,
      uniquePlaces: rows.length,
      withWebsite: rows.filter((row) => row.candidate.website).length,
      withPhone: rows.filter((row) => row.candidate.phone).length,
    },
    rows,
  };

  fs.writeFileSync(repoAbs(OUT_REL), JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(repoAbs(RAW_REL), JSON.stringify({ ok: true, updatedAt: output.updatedAt, requestLog }, null, 2), "utf8");

  console.log("WROTE", OUT_REL);
  console.log({
    uniquePlaces: rows.length,
    withWebsite: output.counts.withWebsite,
    withPhone: output.counts.withPhone,
  });
}

main().catch((e) => {
  console.error("places:pull failed:", e?.message || e);
  process.exit(1);
});
