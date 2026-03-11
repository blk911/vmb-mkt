import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type BeautyZone = {
  zone_id: string;
  center_lat: number;
  center_lon: number;
  radius_miles: number;
  region_id?: string;
  status?: string;
};

type BeautyZoneMember = {
  city?: string;
  zip?: string;
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

type ShopRow = {
  shop_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  license_id: string;
  license_status: string;
  specialty: string;
  lat: number | null;
  lon: number | null;
  coord_source: string;
  address_key: string;
  address_key_base: string;
};

const ROOT = process.cwd();
const PREFERRED_SHOP_CSV = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "raw",
  "REG__Shop_Registration__All_Statuses.csv"
);
const FALLBACK_SHOP_CSV = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "dora_updt_031126",
  "REG_-_Shop_Registration_-_All_Statuses.csv"
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
const ZONES_PATH = path.join(ROOT, "data", "markets", "beauty_zones.json");
const ZONE_MEMBERS_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");
const OUTPUT_PATH = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "derived",
  "dora_shop_index.v1.json"
);

const REQUEST_TIMEOUT_MS = Number(process.env.VMB_DORA_GEOCODE_TIMEOUT_MS || "15000") || 15000;
const GEOCODE_DELAY_MS = Number(process.env.VMB_DORA_GEOCODE_DELAY_MS || "50") || 50;
const MAX_NEW_GEOCODES = Number(process.env.VMB_SHOP_MAX_NEW_GEOCODES || "200") || 200;

function readJson<T>(filePath: string): T {
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
  return [normalizeText(street), normalizeText(city), normalizeText(state), s(zip)].join(" | ");
}

function addressBaseJoinKey(street: string, city: string, state: string, zip: string) {
  return [stripUnitTokens(street), normalizeText(city), normalizeText(state), s(zip)].join(" | ");
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveInputPath() {
  if (fs.existsSync(PREFERRED_SHOP_CSV)) return PREFERRED_SHOP_CSV;
  return FALLBACK_SHOP_CSV;
}

function parseCsvLineLoose(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1] || "";

    if (char === '"') {
      if (!inQuotes && current === "") {
        inQuotes = true;
        continue;
      }
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (inQuotes && (next === "," || next === "" || /\s/.test(next))) {
        inQuotes = false;
        continue;
      }
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsvLoose(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCsvLineLoose(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLineLoose(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function buildCoordsLookup(coordsFile: DoraCoordsFile) {
  const exact = new Map<string, { lat: number; lon: number; source: string }>();
  const base = new Map<string, { lat: number; lon: number; source: string }>();

  for (const row of coordsFile.rows || []) {
    const exactKey = s(row.addressKey);
    if (!exactKey) continue;
    const parts = exactKey.split("|").map((part) => s(part));
    const [street = "", city = "", state = "", zip = ""] = parts;
    const value = { lat: row.lat, lon: row.lon, source: s(row.source) || "dora_address_coords" };
    exact.set(exactKey, value);
    base.set(addressBaseJoinKey(street, city, state, zip), value);
  }

  return { exact, base };
}

function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function geocodeAddress(apiKey: string, address: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetchWithTimeout(url.toString(), REQUEST_TIMEOUT_MS);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  const location = json.results?.[0]?.geometry?.location;
  if (json.status !== "OK" || typeof location?.lat !== "number" || typeof location?.lng !== "number") {
    return null;
  }

  return {
    lat: location.lat,
    lon: location.lng,
    source: "google_geocode",
  };
}

async function main() {
  const inputPath = resolveInputPath();
  const csvText = fs.readFileSync(inputPath, "utf8");
  const parsedRows = parseCsvLoose(csvText);

  const coordsLookup = buildCoordsLookup(readJson<DoraCoordsFile>(DORA_COORDS_PATH));
  const zonesFile = readJson<{ zones: BeautyZone[] }>(ZONES_PATH);
  const membersFile = readJson<{ members: BeautyZoneMember[] }>(ZONE_MEMBERS_PATH);

  const targetCities = new Set(
    (membersFile.members || []).map((member) => normalizeText(s(member.city))).filter(Boolean)
  );
  const targetZips = new Set((membersFile.members || []).map((member) => s(member.zip)).filter(Boolean));
  const targetZones = (zonesFile.zones || []).filter((zone) => (zone.region_id || "DEN") === "DEN");

  let geocodedCount = 0;
  let cachedCount = 0;

  const shops: ShopRow[] = [];

  for (const row of parsedRows) {
    if (s(row["License Type"]) !== "REG") continue;

    const shopName = s(row["Entity Name"]) || s(row["Formatted Name"]);
    const street = [s(row["Address Line 1"]), s(row["Address Line 2"])].filter(Boolean).join(", ");
    const city = s(row["City"]);
    const state = s(row["State"]);
    const zip = s(row["Mail Zip Code"]);
    const licenseId = s(row["License Number"]);
    const licenseStatus = s(row[" License Status Description"]) || s(row["License Status Description"]);
    const specialty = s(row["Specialty"]);

    if (!shopName || !street || !city || !zip || state !== "CO") continue;

    const addressKey = addressJoinKey(street, city, state, zip);
    const addressKeyBase = addressBaseJoinKey(street, city, state, zip);

    let coord = coordsLookup.exact.get(addressKey) || coordsLookup.base.get(addressKeyBase) || null;
    if (coord) cachedCount += 1;

    const inTargetMetroByCityZip = targetCities.has(normalizeText(city)) || targetZips.has(zip);
    const coordForCheck = coord;
    const coordNearTarget = coordForCheck
      ? targetZones.some(
          (zone) =>
            haversineMiles(coordForCheck.lat, coordForCheck.lon, zone.center_lat, zone.center_lon) <=
            Math.max(zone.radius_miles + 5, 8)
        )
      : false;

    if (!inTargetMetroByCityZip && !coordNearTarget) continue;

    if (!coord && geocodedCount < MAX_NEW_GEOCODES) {
      const apiKey = s(process.env.GOOGLE_PLACES_API_KEY);
      if (apiKey) {
        const geocoded = await geocodeAddress(apiKey, `${street}, ${city}, ${state} ${zip}`);
        if (geocoded) {
          coord = geocoded;
          geocodedCount += 1;
          await sleep(GEOCODE_DELAY_MS);
        }
      }
    }

    shops.push({
      shop_name: shopName,
      address: street,
      city,
      state,
      zip,
      license_id: licenseId,
      license_status: licenseStatus,
      specialty,
      lat: coord?.lat ?? null,
      lon: coord?.lon ?? null,
      coord_source: coord?.source || "missing",
      address_key: addressKey,
      address_key_base: addressKeyBase,
    });
  }

  const deduped = Array.from(
    new Map(shops.map((row) => [`${row.license_id}::${row.address_key}`, row] as const)).values()
  ).sort((a, b) =>
    [a.city, a.zip, a.shop_name, a.license_id].join("|").localeCompare([b.city, b.zip, b.shop_name, b.license_id].join("|"))
  );

  const output = {
    generated_at: new Date().toISOString(),
    input_path: inputPath,
    counts: {
      parsed_rows: parsedRows.length,
      shops_written: deduped.length,
      active_shops: deduped.filter((row) => normalizeText(row.license_status) === "ACTIVE").length,
      with_coords: deduped.filter((row) => row.lat != null && row.lon != null).length,
      cached_coords: cachedCount,
      geocoded_new: geocodedCount,
    },
    rows: deduped,
  };

  ensureDirForFile(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Parsed rows: ${output.counts.parsed_rows}`);
  console.log(`Shops written: ${output.counts.shops_written}`);
  console.log(`Active shops: ${output.counts.active_shops}`);
  console.log(`With coords: ${output.counts.with_coords}`);
  console.log(`Cached coords: ${output.counts.cached_coords}`);
  console.log(`New geocodes: ${output.counts.geocoded_new}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
