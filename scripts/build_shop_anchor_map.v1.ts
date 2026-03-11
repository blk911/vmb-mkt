import fs from "node:fs";
import path from "node:path";

type BeautyZoneMember = {
  zone_id: string;
  zone_name: string;
  location_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  category: string;
  subtype: string;
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
};

type ShopIndexFile = {
  rows?: ShopRow[];
};

const ROOT = process.cwd();
const GOOGLE_MEMBERS_PATH = path.join(ROOT, "data", "markets", "beauty_zone_members.json");
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
const OUTPUT_PATH = path.join(ROOT, "data", "markets", "shop_anchor_map.v1.json");

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
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(llc|inc|co|company|corp|corporation)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(value: string) {
  return normalizeText(value)
    .replace(/\b(suite|ste|unit|#)\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function tokenOverlapScore(left: string, right: string) {
  const a = new Set(tokenizeName(left));
  const b = new Set(tokenizeName(right));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / Math.max(a.size, b.size);
}

function categoryForShopName(name: string) {
  const hay = normalizeText(name);
  if (hay.includes("nail")) return "nail";
  if (hay.includes("lash") || hay.includes("brow") || hay.includes("esthetic") || hay.includes("skin")) return "esthe";
  if (hay.includes("barber")) return "barber";
  if (hay.includes("spa")) return "spa";
  if (hay.includes("salon") || hay.includes("hair") || hay.includes("studio")) return "hair";
  return "beauty";
}

function categoryCompatibility(googleCategory: string, shopCategory: string) {
  if (googleCategory === shopCategory) return 1;
  if (googleCategory === "beauty" || shopCategory === "beauty") return 0.6;
  if (googleCategory === "hair" && shopCategory === "spa") return 0.35;
  if (googleCategory === "spa" && shopCategory === "hair") return 0.35;
  return 0;
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

function distanceTier(distanceMiles: number) {
  if (distanceMiles <= 0.05) return { label: "same_building", score: 1 };
  if (distanceMiles <= 0.2) return { label: "same_complex", score: 0.75 };
  if (distanceMiles <= 0.35) return { label: "nearby_cluster", score: 0.5 };
  return null;
}

function nameSimilarity(googleName: string, shopName: string) {
  const normalizedGoogle = normalizeText(googleName);
  const normalizedShop = normalizeText(shopName);
  if (normalizedGoogle === normalizedShop) return 1;
  if (normalizedGoogle && normalizedShop && (normalizedGoogle.includes(normalizedShop) || normalizedShop.includes(normalizedGoogle))) {
    return 0.85;
  }
  return tokenOverlapScore(googleName, shopName);
}

async function main() {
  const membersFile = readJson<{ members: BeautyZoneMember[] }>(GOOGLE_MEMBERS_PATH);
  const shopsFile = readJson<ShopIndexFile>(SHOP_INDEX_PATH);
  const activeShops = (shopsFile.rows || []).filter(
    (shop) => normalizeText(shop.license_status) === "active" && shop.lat != null && shop.lon != null
  );

  const rows = (membersFile.members || [])
    .map((member) => {
      const candidates = activeShops
        .filter((shop) => normalizeText(shop.city) === normalizeText(member.city) || shop.zip === member.zip)
        .map((shop) => {
          const distance = haversineMiles(member.lat, member.lon, shop.lat!, shop.lon!);
          const tier = distanceTier(distance);
          if (!tier) return null;
          const addressExact = normalizeAddress(member.address) === normalizeAddress(shop.address) ? 1 : 0;
          const nameScore = nameSimilarity(member.name, shop.shop_name);
          const categoryScore = categoryCompatibility(member.category, categoryForShopName(shop.shop_name));
          const finalScore = Number(
            (tier.score * 0.45 + Math.max(nameScore, addressExact) * 0.4 + categoryScore * 0.15).toFixed(3)
          );
          if (finalScore < 0.4) return null;
          return {
            google_location_id: member.location_id,
            google_name: member.name,
            google_address: member.address,
            zone_id: member.zone_id,
            zone_name: member.zone_name,
            google_category: member.category,
            google_subtype: member.subtype,
            shop_license_id: shop.license_id,
            shop_name: shop.shop_name,
            shop_address: shop.address,
            shop_city: shop.city,
            shop_zip: shop.zip,
            distance_miles: Number(distance.toFixed(3)),
            distance_tier: tier.label,
            name_similarity: Number(nameScore.toFixed(3)),
            address_exact: Boolean(addressExact),
            category_compatibility: Number(categoryScore.toFixed(3)),
            final_score: finalScore,
            association_confidence:
              finalScore >= 0.8 || (tier.label === "same_building" && (addressExact || nameScore >= 0.8))
                ? "strong"
                : finalScore >= 0.62
                  ? "likely"
                  : "weak",
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if ((b?.final_score || 0) !== (a?.final_score || 0)) return (b?.final_score || 0) - (a?.final_score || 0);
          return (a?.distance_miles || 0) - (b?.distance_miles || 0);
        });

      return candidates[0] || null;
    })
    .filter(Boolean)
    .sort((a, b) =>
      [a?.zone_id, a?.google_name, a?.shop_name].join("|").localeCompare([b?.zone_id, b?.google_name, b?.shop_name].join("|"))
    );

  const topRepeated = rows.reduce<Record<string, number>>((acc, row) => {
    const key = s(row?.shop_name);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const output = {
    generated_at: new Date().toISOString(),
    input_paths: {
      google_members: GOOGLE_MEMBERS_PATH,
      shop_index: SHOP_INDEX_PATH,
    },
    counts: {
      google_rows: membersFile.members?.length || 0,
      active_shops_considered: activeShops.length,
      anchors_written: rows.length,
      strong: rows.filter((row) => row?.association_confidence === "strong").length,
      likely: rows.filter((row) => row?.association_confidence === "likely").length,
      weak: rows.filter((row) => row?.association_confidence === "weak").length,
    },
    top_repeated_shop_links: Object.entries(topRepeated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([shop_name, count]) => ({ shop_name, count })),
    rows,
  };

  ensureDirForFile(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log(`Google rows: ${output.counts.google_rows}`);
  console.log(`Active shops considered: ${output.counts.active_shops_considered}`);
  console.log(`Anchors written: ${output.counts.anchors_written}`);
  console.log(`Strong anchors: ${output.counts.strong}`);
  console.log(`Likely anchors: ${output.counts.likely}`);
  console.log(`Weak anchors: ${output.counts.weak}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
