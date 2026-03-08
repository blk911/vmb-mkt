import fs from "fs";
import path from "path";

type BeautyZone = {
  zone_id: string;
  zone_name: string;
  market: string;
  center_lat: number;
  center_lon: number;
  radius_miles: number;
  status: string;
  notes?: string;
};

type CandidateRow = {
  addressKey?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  candidate?: {
    placeName?: string;
    website?: string;
    phone?: string;
    types?: string[];
    matchScore?: number;
    lat?: number;
    lon?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  name?: string;
};

type CandidatesFile = {
  rows: CandidateRow[];
};

type ZoneMember = {
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
  category: string;
  subtype: string;
  source: string;
  priority_score: number;
  is_anchor: boolean;
};

const ROOT = process.cwd();

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
const OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function norm(s?: string): string {
  return (s ?? "").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickLat(row: CandidateRow): number | null {
  return row.candidate?.lat ?? row.candidate?.latitude ?? row.lat ?? row.latitude ?? null;
}

function pickLon(row: CandidateRow): number | null {
  return row.candidate?.lon ?? row.candidate?.longitude ?? row.lon ?? row.longitude ?? null;
}

function pickName(row: CandidateRow): string {
  return norm(row.candidate?.placeName) || norm(row.name) || norm(row.addressKey) || "unknown";
}

function pickAddress(row: CandidateRow): string {
  return norm(row.candidate?.address) || norm(row.address) || "";
}

function detectCategory(name: string, types: string[]): string {
  const hay = `${name} ${types.join(" ")}`.toLowerCase();

  if (hay.includes("nail")) return "nail";
  if (hay.includes("spa")) return "spa";
  if (hay.includes("brow")) return "brow";
  if (hay.includes("lash")) return "lash";
  if (hay.includes("barber")) return "barber";
  if (hay.includes("salon")) return "hair";
  if (hay.includes("beauty")) return "beauty";

  return "other";
}

function detectSubtype(name: string, types: string[]): string {
  const hay = `${name} ${types.join(" ")}`.toLowerCase();

  if (
    hay.includes("sola") ||
    hay.includes("salon loft") ||
    hay.includes("salons by jc") ||
    hay.includes("phenix")
  ) {
    return "suite";
  }

  return "storefront";
}

function computePriorityScore(category: string, subtype: string, matchScore?: number): number {
  let score = 0;

  if (category === "nail") score += 4;
  else if (category === "hair") score += 3;
  else if (category === "spa") score += 2;
  else if (category === "brow" || category === "lash") score += 2;
  else if (category === "barber") score += 2;
  else if (category === "beauty") score += 1;

  if (subtype === "suite") score += 5;

  if (typeof matchScore === "number") {
    if (matchScore >= 80) score += 3;
    else if (matchScore >= 60) score += 2;
    else if (matchScore >= 40) score += 1;
  }

  return score;
}

function isBeautyBusiness(category: string): boolean {
  return ["nail", "hair", "spa", "brow", "lash", "barber", "beauty"].includes(category);
}

function main() {
  const zonesJson = readJsonFile<{ zones: BeautyZone[] }>(ZONES_PATH);
  const candidatesJson = readJsonFile<CandidatesFile>(CANDIDATES_PATH);

  const members: ZoneMember[] = [];

  for (const row of candidatesJson.rows ?? []) {
    const lat = pickLat(row);
    const lon = pickLon(row);

    if (lat == null || lon == null) continue;

    const name = pickName(row);
    const address = pickAddress(row);
    const city = norm(row.city);
    const state = norm(row.state);
    const zip = norm(row.zip);
    const types = row.candidate?.types ?? [];
    const category = detectCategory(name, types);

    if (!isBeautyBusiness(category)) continue;

    const subtype = detectSubtype(name, types);
    const priorityScore = computePriorityScore(category, subtype, row.candidate?.matchScore);

    for (const zone of zonesJson.zones) {
      const distance = haversineMiles(lat, lon, zone.center_lat, zone.center_lon);

      if (distance <= zone.radius_miles) {
        const locationId = slugify([name, address || row.addressKey || "", zone.zone_id].join("_"));

        members.push({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          market: zone.market,
          location_id: locationId,
          name,
          address,
          city,
          state,
          zip,
          lat,
          lon,
          distance_miles: Number(distance.toFixed(3)),
          category,
          subtype,
          source: "places_candidates.v1.json",
          priority_score: priorityScore,
          is_anchor: priorityScore >= 7,
        });
      }
    }
  }

  members.sort((a, b) => {
    if (a.zone_id !== b.zone_id) return a.zone_id.localeCompare(b.zone_id);
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    return a.distance_miles - b.distance_miles;
  });

  const output = {
    generated_at: new Date().toISOString(),
    input_candidates_path: CANDIDATES_PATH,
    input_zones_path: ZONES_PATH,
    count: members.length,
    members,
  };

  ensureDir(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  const summary = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.zone_id] = (acc[m.zone_id] ?? 0) + 1;
    return acc;
  }, {});

  console.log("WROTE", OUTPUT_PATH);
  console.log("TOTAL MEMBERS:", members.length);
  console.table(summary);
}

main();
