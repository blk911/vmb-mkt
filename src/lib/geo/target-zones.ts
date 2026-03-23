import type { BeautyZone } from "@/lib/markets";

/**
 * Canonical operational zones (Denver–Front Range).
 * IDs are stable for resolver/geo assignment, URL aliases, and work-mode logic.
 * Display labels are short human names only (no “core / corridor / zone” suffixes).
 */
export interface GeoTargetZone {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  priority: number;
  active: boolean;
  /** Optional UI grouping, e.g. “Denver Metro”. */
  region?: string | null;
}

/** Ingest / Markets `zone_id` (beauty_zones.json, live units) → canonical id. */
export const MARKET_ZONE_ID_TO_CANONICAL: Record<string, string> = {
  DT01: "DOWNTOWN_CORE",
  CC01: "CHERRY_CREEK",
  DTC01: "DTC_BELLEVUE",
  TH01: "THORNTON_EAST_I25",
  QC01: "QUEBEC_CORRIDOR",
  WM01: "WESTMINSTER_CORE",
  LF01: "LAFAYETTE_CORE",
  FC01: "FORT_COLLINS_CORE",
};

/** Canonical id → primary Markets catalog `zone_id` (when present in JSON). */
export const CANONICAL_TO_MARKET_ZONE_ID: Record<string, string> = {
  DOWNTOWN_CORE: "DT01",
  CHERRY_CREEK: "CC01",
  DTC_BELLEVUE: "DTC01",
  QUEBEC_CORRIDOR: "QC01",
  THORNTON_EAST_I25: "TH01",
  WESTMINSTER_CORE: "WM01",
  LAFAYETTE_CORE: "LF01",
  FORT_COLLINS_CORE: "FC01",
};

/** Legacy display strings (ingest, bookmarks) → canonical id. */
export const LEGACY_ZONE_DISPLAY_TO_CANONICAL: Record<string, string> = {
  "Downtown Core": "DOWNTOWN_CORE",
  "Downtown Denver Beauty Corridor": "DOWNTOWN_CORE",
  "Cherry Creek Core": "CHERRY_CREEK",
  "DTC Belleview Corridor": "DTC_BELLEVUE",
  "Quebec Corridor": "QUEBEC_CORRIDOR",
  "Thornton East / I-25": "THORNTON_EAST_I25",
  "Thornton Beauty Corridor": "THORNTON_EAST_I25",
  "Westminster Core": "WESTMINSTER_CORE",
  "Lafayette Core": "LAFAYETTE_CORE",
  "Fort Collins Core": "FORT_COLLINS_CORE",
};

const ORDER_INDEX = new Map<string, number>();

export const TARGET_ZONES: GeoTargetZone[] = [
  {
    id: "DOWNTOWN_CORE",
    label: "Downtown",
    centerLat: 39.7439,
    centerLng: -104.9959,
    radiusMiles: 0.6,
    priority: 1,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "CHERRY_CREEK",
    label: "Cherry Creek",
    centerLat: 39.7197,
    centerLng: -104.9538,
    radiusMiles: 0.5,
    priority: 2,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "DTC_BELLEVUE",
    label: "DTC Belleview",
    centerLat: 39.62385,
    centerLng: -104.89431,
    radiusMiles: 1.2,
    priority: 3,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "QUEBEC_CORRIDOR",
    label: "Quebec",
    centerLat: 39.567222,
    centerLng: -104.959583,
    radiusMiles: 0.75,
    priority: 4,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "THORNTON_EAST_I25",
    label: "Thornton",
    centerLat: 39.868,
    centerLng: -104.971,
    radiusMiles: 1.0,
    priority: 5,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "WESTMINSTER_CORE",
    label: "Westminster",
    centerLat: 39.8617,
    centerLng: -105.0505,
    radiusMiles: 1.0,
    priority: 6,
    active: true,
    region: "Denver Metro",
  },
  {
    id: "LAFAYETTE_CORE",
    label: "Lafayette",
    centerLat: 39.9936,
    centerLng: -105.0897,
    radiusMiles: 0.75,
    priority: 7,
    active: true,
    region: "North Metro",
  },
  {
    id: "FORT_COLLINS_CORE",
    label: "Fort Collins",
    centerLat: 40.558222,
    centerLng: -105.078028,
    radiusMiles: 1.0,
    priority: 8,
    active: true,
    region: "Fort Collins",
  },
];

TARGET_ZONES.forEach((z, i) => ORDER_INDEX.set(z.id, i));

const BY_ID = new Map(TARGET_ZONES.map((z) => [z.id, z]));

/** Catalog-only zones (planned / extended markets) — short labels without changing canonical geo ids. */
export const EXTRA_MARKET_ZONE_LABELS: Record<string, string> = {
  BD01: "Boulder",
  CS01: "Colorado Springs",
};

const ACTIVE_CANONICAL_IDS = new Set(TARGET_ZONES.filter((z) => z.active).map((z) => z.id));

/** All alias keys (market ids + legacy labels) → canonical. */
const ANY_TO_CANONICAL = new Map<string, string>();
for (const [k, v] of Object.entries(MARKET_ZONE_ID_TO_CANONICAL)) ANY_TO_CANONICAL.set(k, v);
for (const [k, v] of Object.entries(LEGACY_ZONE_DISPLAY_TO_CANONICAL)) ANY_TO_CANONICAL.set(k, v);

export function getTargetZoneById(id: string): GeoTargetZone | undefined {
  return BY_ID.get(normalizeZoneId(id));
}

/**
 * Normalize ingest ids, legacy labels, and canonical ids to a single canonical `TARGET_ZONES` id.
 * Unknown ids pass through unchanged (e.g. BD01, CS01).
 */
export function normalizeZoneId(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  const direct = BY_ID.get(raw);
  if (direct) return raw;
  const mapped = ANY_TO_CANONICAL.get(raw);
  if (mapped) return mapped;
  return raw;
}

export function getActiveTargetZones(): GeoTargetZone[] {
  return [...TARGET_ZONES].filter((z) => z.active).sort((a, b) => a.priority - b.priority);
}

/** Sort key for dropdowns: canonical order, then unknown ids last. */
export function compareZoneIdsForDisplay(a: string, b: string): number {
  const ca = normalizeZoneId(a);
  const cb = normalizeZoneId(b);
  const ia = ORDER_INDEX.get(ca) ?? 999;
  const ib = ORDER_INDEX.get(cb) ?? 999;
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b);
}

/** User-facing label for any zone id or legacy display string. */
export function getZoneDisplayLabel(raw: string | null | undefined): string {
  if (raw == null || raw === "" || raw === "NO_ZONE") return "No zone";
  const extra = EXTRA_MARKET_ZONE_LABELS[raw];
  if (extra) return extra;
  const canonical = normalizeZoneId(raw);
  const z = BY_ID.get(canonical);
  if (z) return z.label;
  const fromLegacy = LEGACY_ZONE_DISPLAY_TO_CANONICAL[raw];
  if (fromLegacy) {
    const zz = BY_ID.get(fromLegacy);
    if (zz) return zz.label;
  }
  return raw;
}

export function isActiveOperationalZoneId(raw: string | null | undefined): boolean {
  if (raw == null || raw === "") return false;
  return ACTIVE_CANONICAL_IDS.has(normalizeZoneId(raw));
}

/**
 * Map URL/query `zone` param to a Markets `zone_id` (e.g. `QUEBEC_CORRIDOR` → `QC01`).
 * Falls back to `ALL` when unknown or not in the loaded catalog.
 */
export function resolveUrlZoneParamToMarketZoneId(
  raw: string | undefined,
  zones: BeautyZone[]
): string {
  if (!raw || raw === "ALL") return "ALL";
  const zoneIds = new Set(zones.map((z) => z.zone_id));
  if (zoneIds.has(raw)) return raw;
  const fromCanon = CANONICAL_TO_MARKET_ZONE_ID[raw];
  if (fromCanon && zoneIds.has(fromCanon)) return fromCanon;
  const legacyCanon = LEGACY_ZONE_DISPLAY_TO_CANONICAL[raw];
  if (legacyCanon) {
    const mid = CANONICAL_TO_MARKET_ZONE_ID[legacyCanon];
    if (mid && zoneIds.has(mid)) return mid;
  }
  const normalized = normalizeZoneId(raw);
  if (normalized !== raw) {
    const mid2 = CANONICAL_TO_MARKET_ZONE_ID[normalized];
    if (mid2 && zoneIds.has(mid2)) return mid2;
  }
  return "ALL";
}
