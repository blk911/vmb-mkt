import fs from "node:fs";
import path from "node:path";

type LiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lon?: number | null;
  raw_snippets?: {
    google?: {
      id?: string;
      zone_id?: string;
      zone_name?: string;
    };
    dora?: {
      address_key?: string;
      license_row_ids?: string[];
    };
  };
};

type LiveUnitsFile = {
  rows?: LiveUnitRow[];
};

type ShopRow = {
  shop_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  license_id: string;
  license_status: string;
  lat: number | null;
  lon: number | null;
  coord_source: string;
  address_key: string;
  address_key_base: string;
};

type ShopIndexFile = {
  rows?: ShopRow[];
};

type ShopAnchorMapFile = {
  rows?: Array<{
    google_location_id: string;
    shop_license_id: string;
    shop_name: string;
    distance_miles: number;
    association_confidence: "strong" | "likely" | "weak";
  }>;
};

type DoraCoordsFile = {
  rows?: Array<{
    addressKey: string;
    lat: number;
    lon: number;
  }>;
};

type DoraRosterEntry = {
  rowId: string;
  fullName: string;
  addressKey: string;
  addressKeyBase?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseType?: string;
  licenseStatus?: string;
  raw?: Record<string, string>;
};

type DoraRosterFile = {
  byAddressKey?: Record<string, DoraRosterEntry[]>;
};

const ROOT = process.cwd();
const LIVE_UNITS_TUNED_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_tuned.v1.json");
const LIVE_UNITS_BASE_PATH = path.join(ROOT, "data", "markets", "beauty_live_units.v1.json");
const SHOP_INDEX_PATH = path.join(
  ROOT,
  "data",
  "co",
  "dora",
  "denver_metro",
  "dora",
  "derived",
  "dora_shop_index.v1.json"
);
const SHOP_ANCHOR_MAP_PATH = path.join(ROOT, "data", "markets", "shop_anchor_map.v1.json");
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
const SHOP_TECH_ASSOCIATIONS_PATH = path.join(ROOT, "data", "markets", "dora_shop_tech_associations.v1.json");
const OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_shop_context.v1.json");

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

function classifyLicenseType(licenseType: string) {
  const normalized = normalizeText(licenseType);
  if (normalized === "REG") return "shop";
  if (
    normalized === "MAN" ||
    normalized.includes("NAIL") ||
    normalized.includes("MANICURIST")
  ) return "nail";
  if (normalized === "BAR" || normalized.includes("BARBER")) return "barber";
  if (
    normalized === "COZ" ||
    normalized.includes("ESTHETICIAN") ||
    normalized.includes("AESTHETICIAN") ||
    normalized.includes("SKIN CARE") ||
    normalized.includes("LASH") ||
    normalized.includes("BROW")
  ) return "esthe";
  if (normalized.includes("SPA")) return "spa";
  if (
    normalized === "COS" ||
    normalized === "HST" ||
    normalized.includes("COSMETOLOGY") ||
    normalized.includes("HAIR")
  ) return "hair";
  return "other";
}

function resolveLiveUnitsPath() {
  return fs.existsSync(LIVE_UNITS_TUNED_PATH) ? LIVE_UNITS_TUNED_PATH : LIVE_UNITS_BASE_PATH;
}

function main() {
  const liveUnitsFile = readJson<LiveUnitsFile>(resolveLiveUnitsPath());
  const shopIndexFile = readJson<ShopIndexFile>(SHOP_INDEX_PATH);
  const shopAnchorMapFile = readJson<ShopAnchorMapFile>(SHOP_ANCHOR_MAP_PATH);
  const doraRosterFile = readJson<DoraRosterFile>(DORA_ROSTER_PATH);
  const doraCoordsFile = readJson<DoraCoordsFile>(DORA_COORDS_PATH);

  const shops = (shopIndexFile.rows || []).filter(
    (shop) => normalizeText(shop.license_status) === "ACTIVE" && shop.lat != null && shop.lon != null
  );
  const shopByLicense = new Map(shops.map((shop) => [shop.license_id, shop] as const));
  const coordsByAddress = new Map(
    (doraCoordsFile.rows || []).map((row) => [s(row.addressKey), { lat: row.lat, lon: row.lon }] as const)
  );
  const shopAnchorByGoogleId = new Map(
    (shopAnchorMapFile.rows || []).map((row) => [row.google_location_id, row] as const)
  );

  const techAssociations = Object.values(doraRosterFile.byAddressKey || {})
    .flatMap((entries) => entries)
    .filter((entry) => normalizeText(entry.licenseStatus || "") === "ACTIVE")
    .filter((entry) => {
      const category = classifyLicenseType(entry.licenseType || "");
      return category !== "other" && category !== "shop";
    })
    .map((entry) => {
      const coord =
        coordsByAddress.get(s(entry.addressKey)) ||
        coordsByAddress.get(
          addressBaseJoinKey(s(entry.street), s(entry.city), s(entry.state), s(entry.zip))
        );
      if (!coord) return null;

      const candidates = shops
        .filter((shop) => normalizeText(shop.city) === normalizeText(entry.city || "") || shop.zip === s(entry.zip))
        .map((shop) => {
          const distance = haversineMiles(coord.lat, coord.lon, shop.lat!, shop.lon!);
          if (distance > 0.35) return null;
          return {
            shop_license_id: shop.license_id,
            shop_name: shop.shop_name,
            tech_row_id: entry.rowId,
            tech_license_id: s(entry.raw?.["License Number"]) || entry.rowId,
            tech_name: entry.fullName,
            tech_category: classifyLicenseType(entry.licenseType || ""),
            address_key: entry.addressKey,
            distance_to_shop: Number(distance.toFixed(3)),
            association_confidence:
              s(entry.addressKey) === shop.address_key || s(entry.addressKey) === shop.address_key_base
                ? "strong"
                : distance <= 0.05
                  ? "strong"
                  : distance <= 0.2
                    ? "likely"
                    : "weak",
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a?.distance_to_shop || 0) - (b?.distance_to_shop || 0));

      return candidates[0] || null;
    })
    .filter(Boolean);

  const techCountByShop = techAssociations.reduce<Record<string, number>>((acc, row) => {
    acc[row!.shop_license_id] = (acc[row!.shop_license_id] || 0) + 1;
    return acc;
  }, {});

  const contextRows = (liveUnitsFile.rows || []).map((row) => {
    const googleId = s(row.raw_snippets?.google?.id);
    const anchor = googleId ? shopAnchorByGoogleId.get(googleId) : null;

    let matchedShop = anchor ? shopByLicense.get(anchor.shop_license_id) || null : null;
    let shopDistance = anchor?.distance_miles ?? null;
    let associationConfidence = anchor?.association_confidence || null;

    if (!matchedShop && typeof row.lat === "number" && typeof row.lon === "number") {
      const nearest = shops
        .filter((shop) => normalizeText(shop.city) === normalizeText(s(row.city)) || shop.zip === s(row.zip))
        .map((shop) => ({
          shop,
          distance: haversineMiles(row.lat!, row.lon!, shop.lat!, shop.lon!),
        }))
        .filter((candidate) => candidate.distance <= 0.35)
        .sort((a, b) => a.distance - b.distance)[0];

      if (nearest) {
        matchedShop = nearest.shop;
        shopDistance = Number(nearest.distance.toFixed(3));
        associationConfidence =
          nearest.distance <= 0.05 ? "strong" : nearest.distance <= 0.2 ? "likely" : "weak";
      }
    }

    const nearbyTechCount =
      matchedShop?.license_id
        ? techCountByShop[matchedShop.license_id] || 0
        : techAssociations.filter(
            (assoc) =>
              typeof row.lat === "number" &&
              typeof row.lon === "number" &&
              shopByLicense.get(assoc!.shop_license_id) &&
              haversineMiles(
                row.lat!,
                row.lon!,
                shopByLicense.get(assoc!.shop_license_id)!.lat!,
                shopByLicense.get(assoc!.shop_license_id)!.lon!
              ) <= 0.35
          ).length;

    return {
      ...row,
      shop_license: matchedShop?.license_id || null,
      shop_license_name: matchedShop?.shop_name || null,
      shop_distance: shopDistance,
      association_confidence: associationConfidence,
      tech_count_nearby: nearbyTechCount,
    };
  });

  const shopAssocOutput = {
    generated_at: new Date().toISOString(),
    input_paths: {
      shop_index: SHOP_INDEX_PATH,
      dora_roster: DORA_ROSTER_PATH,
      dora_coords: DORA_COORDS_PATH,
    },
    count: techAssociations.length,
    rows: techAssociations.sort((a, b) =>
      [a?.shop_license_id, a?.tech_name, a?.tech_license_id].join("|").localeCompare(
        [b?.shop_license_id, b?.tech_name, b?.tech_license_id].join("|")
      )
    ),
  };

  const output = {
    generated_at: new Date().toISOString(),
    input_paths: {
      live_units: resolveLiveUnitsPath(),
      shop_index: SHOP_INDEX_PATH,
      shop_anchor_map: SHOP_ANCHOR_MAP_PATH,
      shop_tech_associations: SHOP_TECH_ASSOCIATIONS_PATH,
    },
    counts: {
      live_units: contextRows.length,
      matched_to_shop: contextRows.filter((row) => row.shop_license).length,
      with_nearby_techs: contextRows.filter((row) => (row.tech_count_nearby || 0) > 0).length,
    },
    rows: contextRows,
  };

  ensureDirForFile(SHOP_TECH_ASSOCIATIONS_PATH);
  ensureDirForFile(OUTPUT_PATH);
  fs.writeFileSync(SHOP_TECH_ASSOCIATIONS_PATH, JSON.stringify(shopAssocOutput, null, 2), "utf8");
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Tech associations written: ${shopAssocOutput.count}`);
  console.log(`Live units written: ${output.counts.live_units}`);
  console.log(`Matched to shop: ${output.counts.matched_to_shop}`);
  console.log(`With nearby techs: ${output.counts.with_nearby_techs}`);
  console.log(`Wrote: ${SHOP_TECH_ASSOCIATIONS_PATH}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
