import type { BeautyRegion, BeautyZone } from "@/lib/markets";
import { resolveUrlZoneParamToMarketZoneId } from "@/lib/geo/target-zones";
import type { SalesRingMiles } from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import { MARKETS_WORK_PRESETS, type MarketsWorkPreset } from "@/lib/markets/zone-ops-types";

const WORK_PRESET_SET = new Set<string>(MARKETS_WORK_PRESETS);

export type { MarketsWorkPreset };

export type MarketsSortKey =
  | "upgraded_priority_score"
  | "name"
  | "category"
  | "subtype"
  | "address"
  | "dora_density"
  | "profession_mix"
  | "presence"
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
  "presence",
  "is_anchor",
]);

const CATEGORY_FILTERS = ["All", "Hair", "Nail", "Esthe", "Barber", "Spa", "Beauty"] as const;
const SUBTYPE_FILTERS = ["All", "Storefront", "Suite"] as const;

/** Markets page surface: operational work vs build/survey tooling. */
export type MarketsPageMode = "work" | "build";

export type MarketsUrlState = {
  regionId: string;
  zoneId: string;
  category: (typeof CATEGORY_FILTERS)[number];
  subtype: (typeof SUBTYPE_FILTERS)[number];
  sort: MarketsSortKey;
  sortDir: MarketsSortDir;
  /** Client-side work packet filter (query: workPreset). */
  workPreset: MarketsWorkPreset | null;
  /** Query `mode=build` — build/survey entry; default work. */
  mode: MarketsPageMode;
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
    workPreset: null,
    mode: "work",
  };
}

export function parseMarketsUrlSearchParams(
  raw: Record<string, string | string[] | undefined>,
  zones: BeautyZone[],
  regions: BeautyRegion[]
): MarketsUrlState {
  const regionIds = new Set(regions.map((r) => r.region_id));

  let regionId = getFirst(raw, "region") ?? defaultMarketsUrlState().regionId;
  if (!regionIds.has(regionId)) regionId = defaultMarketsUrlState().regionId;

  let zoneId = getFirst(raw, "zone") ?? defaultMarketsUrlState().zoneId;
  zoneId = resolveUrlZoneParamToMarketZoneId(zoneId, zones);
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

  const wpRaw = getFirst(raw, "workPreset") ?? getFirst(raw, "preset");
  let workPreset: MarketsWorkPreset | null = null;
  if (wpRaw && WORK_PRESET_SET.has(wpRaw)) {
    workPreset = wpRaw as MarketsWorkPreset;
  }

  const modeRaw = getFirst(raw, "mode");
  const mode: MarketsPageMode = modeRaw === "build" ? "build" : "work";

  return { regionId, zoneId, category, subtype, sort, sortDir, workPreset, mode };
}

/** Stable identity for React `key` + syncing client state to URL-driven props. */
export function marketsUrlStateKey(state: MarketsUrlState): string {
  return [state.regionId, state.zoneId, state.category, state.subtype, state.sort, state.sortDir, state.workPreset ?? "", state.mode].join("|");
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
  if (state.workPreset) p.set("workPreset", state.workPreset);
  if (state.mode !== "work") p.set("mode", state.mode);
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
  if (state.workPreset) p.set("workPreset", state.workPreset);
  if (state.mode !== "work") p.set("mode", state.mode);
  const q = p.toString();
  const base = `/admin/markets/member/${encodeURIComponent(locationId)}`;
  return q ? `${base}?${q}` : base;
}

/** List radius for `/admin/markets/target/[locationId]?ring=` (default 0.5 mi). */
export function parseRingQuery(raw: string | undefined): SalesRingMiles {
  if (raw === "0.25") return 0.25;
  if (raw === "1" || raw === "1.0") return 1.0;
  return 0.5;
}

/**
 * Dedicated sales target console; preserves zone/markets filters for back navigation.
 * Optional `ring` only added when not default (0.5 mi).
 */
export function buildSalesTargetPath(locationId: string, state: MarketsUrlState, ring?: SalesRingMiles): string {
  const d = defaultMarketsUrlState();
  const p = new URLSearchParams();
  if (state.regionId !== d.regionId) p.set("region", state.regionId);
  if (state.zoneId !== d.zoneId) p.set("zone", state.zoneId);
  if (state.category !== d.category) p.set("category", state.category);
  if (state.subtype !== d.subtype) p.set("subtype", state.subtype);
  if (state.sort !== d.sort) p.set("sort", state.sort);
  if (state.sortDir !== d.sortDir) p.set("sortDir", state.sortDir);
  if (state.workPreset) p.set("workPreset", state.workPreset);
  if (state.mode !== "work") p.set("mode", state.mode);
  if (ring != null && ring !== 0.5) {
    p.set("ring", ring === 1 ? "1" : String(ring));
  }
  const q = p.toString();
  const base = `/admin/markets/target/${encodeURIComponent(locationId)}`;
  return q ? `${base}?${q}` : base;
}
