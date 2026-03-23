/**
 * High-confidence matching between platform listings and existing Live Unit entities.
 * Returns a single best match only when totalScore >= HIGH_CONFIDENCE_THRESHOLD.
 */
import type {
  LiveUnitForPlatformMatch,
  PlatformListing,
  PlatformMatchScore,
} from "./platform-signal-types";
import { deriveServiceSignalsForRow } from "./service-signal-logic";
import type { ServiceSignal } from "./service-signal-types";

/** totalScore = 0.5*name + 0.3*distance + 0.2*service */
export const MATCH_WEIGHT_NAME = 0.5;
export const MATCH_WEIGHT_DISTANCE = 0.3;
export const MATCH_WEIGHT_SERVICE = 0.2;

/** Below this: no attachment (medium/low discarded). */
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;

const GEO_RADIUS_MILES = 0.5;
const SAME_BUILDING_MILES = 0.1;

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 0–1 fuzzy name similarity (token overlap + containment). */
export function nameScoreFor(listingName: string, entityName: string): number {
  const a = normalizeName(listingName);
  const b = normalizeName(entityName);
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const wa = new Set(a.split(" ").filter((w) => w.length > 1));
  const wb = new Set(b.split(" ").filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) {
    if (wb.has(w)) inter += 1;
  }
  const union = wa.size + wb.size - inter;
  const jaccard = union > 0 ? inter / union : 0;
  return Math.min(1, jaccard * 1.15);
}

/**
 * distanceScore: same building / &lt;0.1mi → high; &lt;0.5mi → medium; else low (candidates pre-filtered to 0.5mi).
 */
export function distanceScoreFor(miles: number): number {
  if (miles <= SAME_BUILDING_MILES) return 1;
  if (miles < 0.25) return 0.9;
  if (miles < GEO_RADIUS_MILES) return 0.72;
  return 0.45;
}

const SIGNAL_KEYWORDS: Record<ServiceSignal, string[]> = {
  nails: ["nail", "manicure", "pedicure", "gel", "acrylic", "dip"],
  hair: ["hair", "salon", "cut", "color", "balayage", "stylist", "blowout"],
  esthetics: ["facial", "brow", "lash", "wax", "esthetic", "skin"],
  spa: ["spa", "massage", "body"],
};

function listingHaystack(services: string[]): string {
  return services.join(" ").toLowerCase();
}

/** Overlap between listing service text and entity-derived service signals. */
export function serviceScoreFor(listing: PlatformListing, entity: LiveUnitForPlatformMatch): number {
  const hay = listingHaystack(listing.services);
  if (!hay.trim()) return 0.35;
  const derived = deriveServiceSignalsForRow({
    operational_category: entity.operational_category,
    subtype: entity.subtype,
    signal_mix: entity.signal_mix,
    name_display: entity.name_display,
    explanation: entity.explanation,
  });
  const active: ServiceSignal[] = derived.serviceSignals.length
    ? derived.serviceSignals
    : derived.primaryServiceSignal
      ? [derived.primaryServiceSignal]
      : [];
  if (active.length === 0) return 0.4;

  let hits = 0;
  for (const sig of active) {
    const keys = SIGNAL_KEYWORDS[sig];
    if (keys.some((k) => hay.includes(k))) hits += 1;
  }
  const ratio = hits / active.length;
  const base = 0.35 + 0.65 * ratio;
  return Math.min(1, base);
}

export function totalMatchScore(nameScore: number, distanceScore: number, serviceScore: number): number {
  return (
    MATCH_WEIGHT_NAME * nameScore +
    MATCH_WEIGHT_DISTANCE * distanceScore +
    MATCH_WEIGHT_SERVICE * serviceScore
  );
}

export function matchPlatformListingToEntities(
  listing: PlatformListing,
  entities: LiveUnitForPlatformMatch[]
): { entityId: string; score: PlatformMatchScore } | null {
  if (listing.lat == null || listing.lng == null || Number.isNaN(listing.lat) || Number.isNaN(listing.lng)) {
    return null;
  }

  const candidates: LiveUnitForPlatformMatch[] = [];
  for (const e of entities) {
    if (e.lat == null || e.lon == null || Number.isNaN(e.lat) || Number.isNaN(e.lon)) continue;
    const d = milesBetween(listing.lat, listing.lng, e.lat, e.lon);
    if (d <= GEO_RADIUS_MILES) candidates.push(e);
  }
  if (candidates.length === 0) return null;

  type Scored = {
    entityId: string;
    distance: number;
    score: PlatformMatchScore;
  };

  const scored: Scored[] = [];
  for (const e of candidates) {
    const d = milesBetween(listing.lat, listing.lng, e.lat!, e.lon!);
    const ns = nameScoreFor(listing.name, e.name_display);
    const ds = distanceScoreFor(d);
    const ss = serviceScoreFor(listing, e);
    const total = totalMatchScore(ns, ds, ss);
    if (total < HIGH_CONFIDENCE_THRESHOLD) continue;
    scored.push({
      entityId: entityIdForMatch(e),
      distance: d,
      score: {
        nameScore: ns,
        distanceScore: ds,
        serviceScore: ss,
        totalScore: total,
      },
    });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score.totalScore - a.score.totalScore || a.distance - b.distance);
  const top = scored[0]!;
  return { entityId: top.entityId, score: top.score };
}

function entityIdForMatch(e: LiveUnitForPlatformMatch): string {
  return e.entity_id?.trim() || e.live_unit_id;
}
