import type { ClusterActiveMetrics } from "@/app/admin/markets/_lib/marketsClusterActive";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import { computeActiveRankScore, memberHasActivePresence } from "@/app/admin/markets/_lib/marketsActiveRank";

export type SalesRingMiles = 0.25 | 0.5 | 1.0;

export const SALES_TARGET_RINGS: SalesRingMiles[] = [0.25, 0.5, 1.0];

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/** Haversine distance in miles (same model as zone clustering). */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function memberHasValidCoords(m: EnrichedBeautyZoneMember): boolean {
  const lat = Number(m.lat);
  const lon = Number(m.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** UI-only flags for ranking (read from loaded member JSON; never mutated). */
export type NearbyProspectFlags = {
  is_anchor: boolean;
  member_has_direct_outreach: boolean;
  has_booking: boolean;
  has_instagram: boolean;
  has_path: boolean;
  has_anchor_directory: boolean;
};

export type NearbyProspectRow = NearbyProspectFlags & {
  member: EnrichedBeautyZoneMember;
  distance_miles: number;
  /** `computeActiveRankScore` — outreach readiness. */
  outreach_score: number;
  cluster_opportunity_score: number | null;
  is_hidden_cluster: boolean;
  active: boolean;
  /** Additive sales target score (deterministic, UI-only). */
  nearby_prospect_score: number;
};

/** Map marker / summary classification (anchor → active → path → resolved → fallback). */
export type ProspectMarkerKind = "anchor" | "active" | "path" | "resolved" | "fallback";

export function classifyProspect(row: NearbyProspectRow): ProspectMarkerKind {
  if (row.member.is_anchor) return "anchor";
  if (row.active) return "active";
  if (row.member.path_enrichment_matched === true) return "path";
  if (row.member.gray_resolution_matched === true) return "resolved";
  return "fallback";
}

export function prospectTypeLabel(kind: ProspectMarkerKind): string {
  switch (kind) {
    case "anchor":
      return "Anchor";
    case "active":
      return "Active";
    case "path":
      return "Path enriched";
    case "resolved":
      return "Resolved";
    default:
      return "Low signal";
  }
}

/** Phone / contact hub signals (JSON may include `phone` without TS field). */
function memberHasDirectOutreachSignals(m: EnrichedBeautyZoneMember): boolean {
  const raw = m as Record<string, unknown>;
  const phone = raw.phone;
  if (typeof phone === "string" && phone.trim()) return true;
  if (m.linktree_url?.trim()) return true;
  if (m.path_enrichment_phone?.trim()) return true;
  if (m.anchor_directory_phone?.trim()) return true;
  return false;
}

export function deriveNearbyProspectFlags(m: EnrichedBeautyZoneMember): NearbyProspectFlags {
  const has_booking = !!(m.booking_provider?.trim());
  const has_instagram = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
  const has_path = m.path_enrichment_matched === true;
  const has_anchor_directory = m.anchor_directory_matched === true;
  const member_has_direct_outreach = memberHasDirectOutreachSignals(m);
  return {
    is_anchor: m.is_anchor === true,
    member_has_direct_outreach,
    has_booking,
    has_instagram,
    has_path,
    has_anchor_directory,
  };
}

/**
 * Additive nearby prospect score (UI-only).
 * +3 anchor, +3 direct outreach (phone or linktree), +2 booking, +2 IG, +2 cluster opp ≥6,
 * +1 path enrich, +1 anchor directory; −1 if dist &gt; 0.5 mi; −1 if dist &gt; 0.25 and no direct outreach.
 */
export function computeNearbyProspectScore(
  distance_miles: number,
  cluster_opportunity_score: number | null,
  f: NearbyProspectFlags
): number {
  let s = 0;
  if (f.is_anchor) s += 3;
  if (f.member_has_direct_outreach) s += 3;
  if (f.has_booking) s += 2;
  if (f.has_instagram) s += 2;
  if (cluster_opportunity_score != null && cluster_opportunity_score >= 6) s += 2;
  if (f.has_path) s += 1;
  if (f.has_anchor_directory) s += 1;
  if (distance_miles > 0.5) s -= 1;
  if (distance_miles > 0.25 && !f.member_has_direct_outreach) s -= 1;
  return s;
}

/** Default list order within sidebar sections. */
export function compareNearbyProspectRank(a: NearbyProspectRow, b: NearbyProspectRow): number {
  if (b.nearby_prospect_score !== a.nearby_prospect_score) {
    return b.nearby_prospect_score - a.nearby_prospect_score;
  }
  if (b.outreach_score !== a.outreach_score) return b.outreach_score - a.outreach_score;
  const pa = a.member.priority_score ?? 0;
  const pb = b.member.priority_score ?? 0;
  if (pb !== pa) return pb - pa;
  if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
  return a.member.name.localeCompare(b.member.name, undefined, { sensitivity: "base" });
}

export function sortNearbyProspectsByRank(rows: NearbyProspectRow[]): NearbyProspectRow[] {
  return [...rows].sort(compareNearbyProspectRank);
}

/** Prospects within `maxMiles` of origin (exclusive origin row). Order is not significant; sections re-sort. */
export function buildNearbyProspects(
  origin: EnrichedBeautyZoneMember,
  members: EnrichedBeautyZoneMember[],
  clusterMetricsById: Map<string, ClusterActiveMetrics>,
  maxMiles: number
): NearbyProspectRow[] {
  if (!memberHasValidCoords(origin)) return [];

  const out: NearbyProspectRow[] = [];
  for (const m of members) {
    if (m.location_id === origin.location_id) continue;
    if (!memberHasValidCoords(m)) continue;
    const d = haversineMiles(origin.lat, origin.lon, m.lat, m.lon);
    if (d > maxMiles) continue;
    const met = clusterMetricsById.get(m.cluster_id);
    const cluster_opportunity_score = met?.cluster_opportunity_score ?? null;
    const flags = deriveNearbyProspectFlags(m);
    const nearby_prospect_score = computeNearbyProspectScore(d, cluster_opportunity_score, flags);
    out.push({
      member: m,
      distance_miles: d,
      outreach_score: computeActiveRankScore(m),
      cluster_opportunity_score,
      is_hidden_cluster: met?.is_hidden_opportunity === true,
      active: memberHasActivePresence(m),
      nearby_prospect_score,
      ...flags,
    });
  }
  return out;
}

export type RingRollup = {
  anchors: number;
  active: number;
  distinct_clusters: number;
};

export function rollupForRing(rows: NearbyProspectRow[], maxMiles: number): RingRollup {
  const inRing = rows.filter((r) => r.distance_miles <= maxMiles);
  const clusters = new Set<string>();
  let anchors = 0;
  let active = 0;
  for (const r of inRing) {
    if (r.member.is_anchor) anchors += 1;
    if (r.active) active += 1;
    if (r.member.cluster_id) clusters.add(r.member.cluster_id);
  }
  return {
    anchors,
    active,
    distinct_clusters: clusters.size,
  };
}
