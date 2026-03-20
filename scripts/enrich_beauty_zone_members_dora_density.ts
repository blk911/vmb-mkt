import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type BeautyZone = {
  zone_id: string;
  region_id?: string;
  radius_miles: number;
  status: string;
};

type BeautyZoneMember = {
  zone_id: string;
  location_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  category?: string;
  category_raw?: string;
  category_source_labels_raw?: string[];
  subtype?: string;
};

type CandidateRow = {
  addressKey?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  candidate?: {
    lat?: number;
    lon?: number;
    latitude?: number;
    longitude?: number;
  };
};

type DoraRosterRow = {
  addressKey?: string;
  licenseType?: string;
  fullName?: string;
  licenseStatus?: string;
  rowId?: string;
};

/** Heuristic: DORA registered address this close to the listing GPS ≈ same building / pad (not legal proof). */
const NEARBY_INSTORE_LIKELY_MILES = 0.02;
const MAX_LICENSE_ROWS_PER_MEMBER = 250;

function roundMiles(m: number) {
  return Math.round(m * 10000) / 10000;
}

type DoraAddressAggregate = {
  addressKey: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  total: number;
  hair: number;
  nail: number;
  esthe: number;
  barber: number;
  spa: number;
  professionMixRaw: Record<string, number>;
};

type DoraCoord = {
  lat: number;
  lon: number;
  source: string;
  updatedAt: string;
};

type DoraCoordsFile = {
  ok: true;
  updatedAt: string;
  counts: {
    cachedAddresses: number;
  };
  rows: Array<DoraCoord & { addressKey: string }>;
};

const ROOT = process.cwd();
const MEMBERS_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");
const ENRICHED_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members_enriched.json");
const ZONES_PATH = path.join(ROOT, "data", "markets", "beauty_zones.json");
const CANDIDATES_PATH = path.join(
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

const REQUEST_TIMEOUT_MS = Number(process.env.VMB_DORA_GEOCODE_TIMEOUT_MS || "15000") || 15000;
const GEOCODE_DELAY_MS = Number(process.env.VMB_DORA_GEOCODE_DELAY_MS || "50") || 50;
const MAX_NEW_GEOCODES = Number(process.env.VMB_DORA_MAX_NEW_GEOCODES || "500") || 500;
const MIN_LICENSES_TO_GEOCODE = Number(process.env.VMB_DORA_MIN_ADDRESS_LICENSES || "2") || 2;

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function s(v: unknown) {
  return String(v ?? "").trim();
}

function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAddressKey(addressKey: string) {
  const [street = "", city = "", state = "", zip = ""] = addressKey.split("|").map((part) => s(part));
  return { street, city, state, zip };
}

function normalizeText(value: string) {
  return value
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripUnitTokens(street: string) {
  return normalizeText(street)
    .replace(/\b(APT|UNIT|STE|SUITE|FL|FLOOR|RM|ROOM|BLDG|BUILDING|LOT|#)\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addressJoinKey(street: string, city: string, state: string, zip: string) {
  return [normalizeText(street), normalizeText(city), normalizeText(state), s(zip)].join("|");
}

function addressBaseJoinKey(street: string, city: string, state: string, zip: string) {
  return [stripUnitTokens(street), normalizeText(city), normalizeText(state), s(zip)].join("|");
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

function classifyLicenseType(licenseType: string) {
  const normalized = normalizeText(licenseType);

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

function resolveDensityProfile(zone: BeautyZone) {
  if (zone.region_id === "DEN") {
    return { profile: "urban", radiusMiles: 0.5 };
  }
  if (zone.radius_miles <= 1.5) {
    return { profile: "suburban", radiusMiles: 1.0 };
  }
  return { profile: "rural", radiusMiles: 3.0 };
}

function buildGoogleCoordLookup(members: BeautyZoneMember[], candidates: CandidateRow[]) {
  const lookup = new Map<string, DoraCoord>();

  const setLookup = (
    street: string,
    city: string,
    state: string,
    zip: string,
    lat: number | null,
    lon: number | null,
    source: string
  ) => {
    if (lat == null || lon == null) return;
    const exactKey = addressJoinKey(street, city, state, zip);
    const baseKey = addressBaseJoinKey(street, city, state, zip);
    const coord = { lat, lon, source, updatedAt: new Date().toISOString() };
    if (!lookup.has(exactKey)) lookup.set(exactKey, coord);
    if (!lookup.has(baseKey)) lookup.set(baseKey, coord);
  };

  for (const member of members) {
    setLookup(member.address, member.city, member.state, member.zip, member.lat, member.lon, "beauty_zone_member");
  }

  for (const row of candidates) {
    const addressKey = s(row.addressKey);
    const parsed = addressKey ? parseAddressKey(addressKey) : null;
    const street = parsed?.street || s(row.address);
    const city = parsed?.city || s(row.city);
    const state = parsed?.state || s(row.state);
    const zip = parsed?.zip || s(row.zip);
    const lat = n(row.candidate?.lat) ?? n(row.candidate?.latitude) ?? n(row.lat);
    const lon = n(row.candidate?.lon) ?? n(row.candidate?.longitude) ?? n(row.lon);
    setLookup(street, city, state, zip, lat, lon, "places_candidates");
  }

  return lookup;
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

async function geocodeAddress(apiKey: string, addressKey: string): Promise<DoraCoord | null> {
  const { street, city, state, zip } = parseAddressKey(addressKey);
  const query = [street, city, state, zip].filter(Boolean).join(", ");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);

  const res = await fetchWithTimeout(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`DORA geocode failed for ${addressKey}: ${res.status}`);
  }
  if (s(json.status) !== "OK") {
    return null;
  }

  const location = json.results?.[0]?.geometry?.location;
  const lat = n(location?.lat);
  const lon = n(location?.lng);
  if (lat == null || lon == null) return null;

  return {
    lat,
    lon,
    source: "google_geocode",
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const apiKey = s(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY");

  const membersJson = readJsonFile<{ generated_at: string; members: BeautyZoneMember[] }>(MEMBERS_PATH);
  const zonesJson = readJsonFile<{ zones: BeautyZone[] }>(ZONES_PATH);
  const candidatesJson = readJsonFile<{ rows: CandidateRow[] }>(CANDIDATES_PATH);
  const rosterJson = readJsonFile<{ byAddressKey?: Record<string, DoraRosterRow[]> }>(DORA_ROSTER_PATH);
  const coordsJson = fs.existsSync(DORA_COORDS_PATH)
    ? readJsonFile<DoraCoordsFile>(DORA_COORDS_PATH)
    : null;

  const members = membersJson.members ?? [];
  const zones = new Map((zonesJson.zones ?? []).map((zone) => [zone.zone_id, zone] as const));
  const googleCoordLookup = buildGoogleCoordLookup(members, candidatesJson.rows ?? []);
  const doraCoords = new Map<string, DoraCoord>(
    (coordsJson?.rows ?? []).map((row) => [row.addressKey, { lat: row.lat, lon: row.lon, source: row.source, updatedAt: row.updatedAt }])
  );

  const memberZips = new Set(members.map((member) => s(member.zip)).filter(Boolean));
  const memberJoinKeys = new Set<string>();
  const memberBaseJoinKeys = new Set<string>();
  for (const member of members) {
    memberJoinKeys.add(addressJoinKey(member.address, member.city, member.state, member.zip));
    memberBaseJoinKeys.add(addressBaseJoinKey(member.address, member.city, member.state, member.zip));
  }

  const doraAddresses: DoraAddressAggregate[] = [];
  for (const [addressKey, rows] of Object.entries(rosterJson.byAddressKey ?? {})) {
    const parsed = parseAddressKey(addressKey);
    if (!memberZips.has(parsed.zip)) continue;

    let hair = 0;
    let nail = 0;
    let esthe = 0;
    let barber = 0;
    let spa = 0;
    const professionMixRaw: Record<string, number> = {};
    for (const row of rows) {
      const classification = classifyLicenseType(s(row.licenseType));
      professionMixRaw[classification.rawLabel] = (professionMixRaw[classification.rawLabel] ?? 0) + 1;

      switch (classification.category) {
        case "hair":
          hair++;
          break;
        case "nail":
          nail++;
          break;
        case "esthe":
          esthe++;
          break;
        case "barber":
          barber++;
          break;
        case "spa":
          spa++;
          break;
        default:
          break;
      }
    }

    doraAddresses.push({
      addressKey,
      street: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      total: rows.length,
      hair,
      nail,
      esthe,
      barber,
      spa,
      professionMixRaw,
    });
  }

  let newGeocodeCount = 0;
  for (const address of doraAddresses) {
    if (doraCoords.has(address.addressKey)) continue;

    const exactKey = addressJoinKey(address.street, address.city, address.state, address.zip);
    const baseKey = addressBaseJoinKey(address.street, address.city, address.state, address.zip);
    const googleCoord = googleCoordLookup.get(exactKey) ?? googleCoordLookup.get(baseKey);
    if (googleCoord) {
      doraCoords.set(address.addressKey, googleCoord);
      continue;
    }

    const directMemberMatch = memberJoinKeys.has(exactKey) || memberBaseJoinKeys.has(baseKey);
    if (!directMemberMatch && address.total < MIN_LICENSES_TO_GEOCODE) {
      continue;
    }
    if (newGeocodeCount >= MAX_NEW_GEOCODES) {
      continue;
    }

    const geocoded = await geocodeAddress(apiKey, address.addressKey);
    if (geocoded) {
      doraCoords.set(address.addressKey, geocoded);
    }
    newGeocodeCount++;
    if (GEOCODE_DELAY_MS > 0) await sleep(GEOCODE_DELAY_MS);
  }

  const geocodedAddresses = doraAddresses
    .map((address) => {
      const coord = doraCoords.get(address.addressKey);
      if (!coord) return null;
      return { ...address, lat: coord.lat, lon: coord.lon, coordSource: coord.source };
    })
    .filter(Boolean) as Array<DoraAddressAggregate & { lat: number; lon: number; coordSource: string }>;

  const enrichedMembers = members.map((member) => {
    const zone = zones.get(member.zone_id);
    const density = resolveDensityProfile(
      zone ?? { zone_id: member.zone_id, radius_miles: 1, status: "target", region_id: "DEN" }
    );

    let nearbyTotal = 0;
    let nearbyHair = 0;
    let nearbyNail = 0;
    let nearbyEsthe = 0;
    let nearbyBarber = 0;
    let nearbySpa = 0;
    const nearbyProfessionMixRaw: Record<string, number> = {};

    const rankedAddresses: Array<{
      addressKey: string;
      distance_miles: number;
      license_count: number;
      hair: number;
      nail: number;
      esthe: number;
      barber: number;
      spa: number;
    }> = [];

    for (const address of geocodedAddresses) {
      const distance = haversineMiles(member.lat, member.lon, address.lat, address.lon);
      if (distance > density.radiusMiles) continue;

      const dm = roundMiles(distance);
      rankedAddresses.push({
        addressKey: address.addressKey,
        distance_miles: dm,
        license_count: address.total,
        hair: address.hair,
        nail: address.nail,
        esthe: address.esthe,
        barber: address.barber,
        spa: address.spa,
      });

      nearbyTotal += address.total;
      nearbyHair += address.hair;
      nearbyNail += address.nail;
      nearbyEsthe += address.esthe;
      nearbyBarber += address.barber;
      nearbySpa += address.spa;

      for (const [rawLabel, count] of Object.entries(address.professionMixRaw)) {
        nearbyProfessionMixRaw[rawLabel] = (nearbyProfessionMixRaw[rawLabel] ?? 0) + count;
      }
    }

    rankedAddresses.sort((a, b) => a.distance_miles - b.distance_miles);

    const rosterByKey = rosterJson.byAddressKey ?? {};
    const licenseRowsDetailed: Array<{
      fullName: string;
      licenseType: string;
      licenseStatus: string;
      rowId: string;
      addressKey: string;
      distance_miles: number;
    }> = [];

    for (const a of rankedAddresses) {
      const rows = rosterByKey[a.addressKey] ?? [];
      for (const row of rows) {
        licenseRowsDetailed.push({
          fullName: s(row.fullName),
          licenseType: s(row.licenseType),
          licenseStatus: s(row.licenseStatus),
          rowId: s(row.rowId),
          addressKey: a.addressKey,
          distance_miles: a.distance_miles,
        });
      }
    }

    licenseRowsDetailed.sort((a, b) => {
      if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
      return a.fullName.localeCompare(b.fullName);
    });

    const nearby_dora_licenses_ranked = licenseRowsDetailed.slice(0, MAX_LICENSE_ROWS_PER_MEMBER);
    const nearby_dora_instore_likely_count = licenseRowsDetailed.filter(
      (r) => r.distance_miles <= NEARBY_INSTORE_LIKELY_MILES
    ).length;
    const nearby_dora_ring_count = Math.max(0, licenseRowsDetailed.length - nearby_dora_instore_likely_count);

    return {
      ...member,
      nearby_dora_licenses_total: nearbyTotal,
      nearby_dora_hair_count: nearbyHair,
      nearby_dora_nail_count: nearbyNail,
      nearby_dora_esthe_count: nearbyEsthe,
      nearby_dora_barber_count: nearbyBarber,
      nearby_dora_spa_count: nearbySpa,
      nearby_dora_operational_mix: {
        hair: nearbyHair,
        nail: nearbyNail,
        esthe: nearbyEsthe,
        barber: nearbyBarber,
        spa: nearbySpa,
      },
      nearby_dora_profession_mix_raw: nearbyProfessionMixRaw,
      dora_density_radius_miles: density.radiusMiles,
      dora_density_profile: density.profile,
      nearby_dora_instore_threshold_miles: NEARBY_INSTORE_LIKELY_MILES,
      nearby_dora_addresses_ranked: rankedAddresses,
      nearby_dora_licenses_ranked,
      nearby_dora_instore_likely_count,
      nearby_dora_ring_count,
    };
  });

  ensureDirForFile(DORA_COORDS_PATH);
  const coordsRows = Array.from(doraCoords.entries())
    .map(([addressKey, coord]) => ({ addressKey, ...coord }))
    .sort((a, b) => a.addressKey.localeCompare(b.addressKey));
  fs.writeFileSync(
    DORA_COORDS_PATH,
    JSON.stringify(
      {
        ok: true,
        updatedAt: new Date().toISOString(),
        counts: {
          cachedAddresses: coordsRows.length,
        },
        rows: coordsRows,
      },
      null,
      2
    ),
    "utf8"
  );

  ensureDirForFile(ENRICHED_PATH);
  fs.writeFileSync(
    ENRICHED_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        input_members_path: MEMBERS_PATH,
        input_dora_roster_path: DORA_ROSTER_PATH,
        input_dora_coords_path: DORA_COORDS_PATH,
        counts: {
          members: enrichedMembers.length,
          doraAddressesConsidered: doraAddresses.length,
          doraAddressesGeocoded: geocodedAddresses.length,
          newGeocodes: newGeocodeCount,
        },
        members: enrichedMembers,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("WROTE", ENRICHED_PATH);
  console.log({
    members: enrichedMembers.length,
    doraAddressesConsidered: doraAddresses.length,
    doraAddressesGeocoded: geocodedAddresses.length,
    newGeocodes: newGeocodeCount,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
