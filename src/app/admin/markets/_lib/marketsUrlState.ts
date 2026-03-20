import type { BeautyRegion, BeautyZone } from "@/lib/markets";

export type MarketsSortKey =
  | "upgraded_priority_score"
  | "name"
  | "category"
  | "subtype"
  | "address"
  | "dora_density"
  | "profession_mix"
  | "is_anchor";

export type MarketsSortDir = "asc" | "desc";

const SORT_KEYS = new Set<MarketsSortKey>([
  "upgraded_priority_score",
  "name",
  "category",
  "subtype",
  "address",
  "dora_density",
  "profession_mix",
  "is_anchor",
]);

const CATEGORY_FILTERS = ["All", "Hair", "Nail", "Esthe", "Barber", "Spa", "Beauty"] as const;
const SUBTYPE_FILTERS = ["All", "Storefront", "Suite"] as const;

export type MarketsUrlState = {
  regionId: string;
  zoneId: string;
  category: (typeof CATEGORY_FILTERS)[number];
  subtype: (typeof SUBTYPE_FILTERS)[number];
  sort: MarketsSortKey;
  sortDir: MarketsSortDir;
};

function getFirst(raw: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = raw[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function defaultMarketsUrlState(): MarketsUrlState {
  return {
    regionId: "DEN",
    zoneId: "ALL",
    category: "All",
    subtype: "All",
    sort: "upgraded_priority_score",
    sortDir: "desc",
  };
}

export function parseMarketsUrlSearchParams(
  raw: Record<string, string | string[] | undefined>,
  zones: BeautyZone[],
  regions: BeautyRegion[]
): MarketsUrlState {
  const regionIds = new Set(regions.map((r) => r.region_id));
  const zoneIds = new Set(zones.map((z) => z.zone_id));

  let regionId = getFirst(raw, "region") ?? defaultMarketsUrlState().regionId;
  if (!regionIds.has(regionId)) regionId = defaultMarketsUrlState().regionId;

  let zoneId = getFirst(raw, "zone") ?? defaultMarketsUrlState().zoneId;
  if (zoneId !== "ALL" && !zoneIds.has(zoneId)) zoneId = "ALL";
  if (zoneId !== "ALL" && !zones.some((z) => z.zone_id === zoneId && z.region_id === regionId)) {
    zoneId = "ALL";
  }

  const catRaw = getFirst(raw, "category") ?? "All";
  const category = CATEGORY_FILTERS.includes(catRaw as (typeof CATEGORY_FILTERS)[number])
    ? (catRaw as (typeof CATEGORY_FILTERS)[number])
    : "All";

  const subRaw = getFirst(raw, "subtype") ?? "All";
  const subtype = SUBTYPE_FILTERS.includes(subRaw as (typeof SUBTYPE_FILTERS)[number])
    ? (subRaw as (typeof SUBTYPE_FILTERS)[number])
    : "All";

  const sortRaw = getFirst(raw, "sort") ?? "upgraded_priority_score";
  const sort: MarketsSortKey = SORT_KEYS.has(sortRaw as MarketsSortKey)
    ? (sortRaw as MarketsSortKey)
    : "upgraded_priority_score";

  const dirRaw = getFirst(raw, "sortDir") ?? "desc";
  const sortDir: MarketsSortDir = dirRaw === "asc" ? "asc" : "desc";

  return { regionId, zoneId, category, subtype, sort, sortDir };
}

/** Stable identity for React `key` + syncing client state to URL-driven props. */
export function marketsUrlStateKey(state: MarketsUrlState): string {
  return [state.regionId, state.zoneId, state.category, state.subtype, state.sort, state.sortDir].join("|");
}

function normalizePathQuery(path: string): string {
  const base = path.startsWith("http") ? path : `http://x.local${path.startsWith("/") ? "" : "/"}${path}`;
  const u = new URL(base);
  const p = new URLSearchParams(u.search);
  const keys = [...new Set([...p.keys()])].sort();
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = p.get(k);
    if (v != null) out.set(k, v);
  }
  const q = out.toString();
  return `${u.pathname}${q ? `?${q}` : ""}`;
}

/** True if two /admin/markets paths match (query order–independent). */
export function marketsListPathsEqual(a: string, b: string): boolean {
  return normalizePathQuery(a) === normalizePathQuery(b);
}

/** Path + query for /admin/markets (only non-default query parts). */
export function buildMarketsListPath(state: MarketsUrlState): string {
  const d = defaultMarketsUrlState();
  const p = new URLSearchParams();
  if (state.regionId !== d.regionId) p.set("region", state.regionId);
  if (state.zoneId !== d.zoneId) p.set("zone", state.zoneId);
  if (state.category !== d.category) p.set("category", state.category);
  if (state.subtype !== d.subtype) p.set("subtype", state.subtype);
  if (state.sort !== d.sort) p.set("sort", state.sort);
  if (state.sortDir !== d.sortDir) p.set("sortDir", state.sortDir);
  const q = p.toString();
  return q ? `/admin/markets?${q}` : "/admin/markets";
}

/** Listing detail URL including current Markets context for Back navigation. */
export function buildMemberDetailPath(locationId: string, state: MarketsUrlState): string {
  const d = defaultMarketsUrlState();
  const p = new URLSearchParams();
  if (state.regionId !== d.regionId) p.set("region", state.regionId);
  if (state.zoneId !== d.zoneId) p.set("zone", state.zoneId);
  if (state.category !== d.category) p.set("category", state.category);
  if (state.subtype !== d.subtype) p.set("subtype", state.subtype);
  if (state.sort !== d.sort) p.set("sort", state.sort);
  if (state.sortDir !== d.sortDir) p.set("sortDir", state.sortDir);
  const q = p.toString();
  const base = `/admin/markets/member/${encodeURIComponent(locationId)}`;
  return q ? `${base}?${q}` : base;
}
