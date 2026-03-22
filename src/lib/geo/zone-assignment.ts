import type { UnknownResolverRecord } from "@/lib/unknown-resolver/resolver-types";
import { TARGET_ZONES, type GeoTargetZone } from "./target-zones";

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/** Haversine distance in miles (same Earth radius as admin sales map helpers). */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** All active zones whose radius contains the point. Sorted by zone id (deterministic). */
export function getMatchingZonesForPoint(
  lat: number,
  lng: number,
  zones: readonly GeoTargetZone[] = TARGET_ZONES
): string[] {
  const matched: { id: string }[] = [];
  for (const z of zones) {
    if (!z.active) continue;
    const d = haversineMiles(lat, lng, z.centerLat, z.centerLng);
    if (d <= z.radiusMiles) {
      matched.push({ id: z.id });
    }
  }
  matched.sort((a, b) => a.id.localeCompare(b.id));
  return matched.map((m) => m.id);
}

/** Closest zone center among matches, or null if none. */
export function getPrimaryZoneForPoint(
  lat: number,
  lng: number,
  zones: readonly GeoTargetZone[] = TARGET_ZONES
): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const z of zones) {
    if (!z.active) continue;
    const d = haversineMiles(lat, lng, z.centerLat, z.centerLng);
    if (d <= z.radiusMiles) {
      if (!best || d < best.dist) {
        best = { id: z.id, dist: d };
      }
    }
  }
  return best?.id ?? null;
}

export function getZoneLabel(zoneId: string): string | null {
  const z = TARGET_ZONES.find((x) => x.id === zoneId);
  return z?.label ?? null;
}

/** Assign zones + primary from record coordinates. Display/filter only — does not affect scoring. */
export function assignZonesToRecord(record: UnknownResolverRecord): UnknownResolverRecord {
  const lat = record.lat;
  const lng = record.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ...record, zones: [], primaryZone: null };
  }
  const zones = getMatchingZonesForPoint(lat, lng);
  const primaryZone = getPrimaryZoneForPoint(lat, lng);
  return { ...record, zones, primaryZone };
}
