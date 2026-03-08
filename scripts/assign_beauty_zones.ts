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
  category_raw: string;
  category_source_labels_raw: string[];
  google_types_raw: string[];
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

function detectCategory(name: string, types: string[]): {
  category: string;
  categoryRaw: string;
  sourceLabelsRaw: string[];
} {
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const hay = `${name} ${normalizedTypes.join(" ")}`.toLowerCase();
  const sourceLabelsRaw: string[] = [];

  const addRaw = (label: string, condition: boolean) => {
    if (condition && !sourceLabelsRaw.includes(label)) {
      sourceLabelsRaw.push(label);
    }
  };

  addRaw("nail_salon", normalizedTypes.includes("nail_salon"));
  addRaw("nail salon", hay.includes("nail salon"));
  addRaw("nail", hay.includes("nail"));
  addRaw("manicure", hay.includes("manicure"));
  addRaw("pedicure", hay.includes("pedicure"));

  addRaw("barber_shop", normalizedTypes.includes("barber_shop"));
  addRaw("barber shop", hay.includes("barber shop"));
  addRaw("barber", hay.includes("barber"));

  addRaw("day spa", hay.includes("day spa"));
  addRaw("spa", normalizedTypes.includes("spa") || hay.includes("spa"));

  addRaw("eyebrow", hay.includes("eyebrow"));
  addRaw("brow", hay.includes("brow"));
  addRaw("lash", hay.includes("lash"));
  addRaw("lashes", hay.includes("lashes"));
  addRaw("wax", hay.includes("wax"));
  addRaw("waxing", hay.includes("waxing"));
  addRaw("facial", hay.includes("facial"));
  addRaw("esthetic", hay.includes("esthetic"));
  addRaw("aesthetic", hay.includes("aesthetic"));
  addRaw("skin care", hay.includes("skin care"));
  addRaw("skincare", hay.includes("skincare"));

  addRaw("beauty_salon", normalizedTypes.includes("beauty_salon"));
  addRaw("hair_care", normalizedTypes.includes("hair_care"));
  addRaw("salon", hay.includes("salon"));
  addRaw("hair", hay.includes("hair"));
  addRaw("stylist", hay.includes("stylist"));
  addRaw("cosmetology", hay.includes("cosmetology"));

  addRaw("beauty", hay.includes("beauty"));
  addRaw("studio", hay.includes("studio"));

  const category =
    sourceLabelsRaw.some((label) => ["nail_salon", "nail salon", "nail", "manicure", "pedicure"].includes(label))
      ? "nail"
      : sourceLabelsRaw.some((label) => ["barber_shop", "barber shop", "barber"].includes(label))
        ? "barber"
        : sourceLabelsRaw.some((label) => ["day spa", "spa"].includes(label))
          ? "spa"
          : sourceLabelsRaw.some((label) =>
              [
                "eyebrow",
                "brow",
                "lash",
                "lashes",
                "wax",
                "waxing",
                "facial",
                "esthetic",
                "aesthetic",
                "skin care",
                "skincare",
              ].includes(label)
            )
            ? "esthe"
            : sourceLabelsRaw.some((label) =>
                ["beauty_salon", "hair_care", "salon", "hair", "stylist", "cosmetology"].includes(label)
              )
              ? "hair"
              : sourceLabelsRaw.some((label) => ["beauty", "studio"].includes(label))
                ? "beauty"
                : "other";

  return {
    category,
    categoryRaw: sourceLabelsRaw[0] ?? "other",
    sourceLabelsRaw,
  };
}

function detectSubtype(name: string, types: string[]): string {
  const hay = `${name} ${types.join(" ")}`.toLowerCase();

  if (
    hay.includes("sola") ||
    hay.includes("lofts") ||
    hay.includes("suites") ||
    hay.includes("studios") ||
    hay.includes("salon loft") ||
    hay.includes("salons by jc") ||
    hay.includes("phenix") ||
    hay.includes("image studios")
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
  else if (category === "esthe") score += 2;
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
  return ["nail", "hair", "esthe", "barber", "spa", "beauty"].includes(category);
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
    const categoryDetails = detectCategory(name, types);
    const category = categoryDetails.category;

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
          category_raw: categoryDetails.categoryRaw,
          category_source_labels_raw: categoryDetails.sourceLabelsRaw,
          google_types_raw: [...types],
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
