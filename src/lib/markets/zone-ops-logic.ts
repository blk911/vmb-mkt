/**
 * Derive per-zone ops metrics and work-preset filters from Markets datasets.
 */
import type { BeautyZone, BeautyZoneCluster, EnrichedBeautyZoneMember } from "@/lib/markets";
import { getZoneDisplayLabel } from "@/lib/geo/target-zones";
import type { MarketsWorkPreset, ZoneOpsSummary } from "./zone-ops-types";

const HIGH_PRIORITY_MIN = 70;
const NEEDS_REVIEW_MIN = 40;
const NEEDS_REVIEW_MAX = 69;

function membersInZone(members: EnrichedBeautyZoneMember[], zoneId: string): EnrichedBeautyZoneMember[] {
  return members.filter((m) => m.zone_id === zoneId);
}

function isBookable(m: EnrichedBeautyZoneMember): boolean {
  return !!(m.booking_url?.trim() || m.booking_provider?.trim());
}

function memberHasActivePresence(m: EnrichedBeautyZoneMember): boolean {
  const ig = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
  const bp = !!m.booking_provider?.trim();
  return ig || bp;
}

function computeActiveRankScore(m: EnrichedBeautyZoneMember): number {
  let s = 0;
  const booking = !!(m.booking_url?.trim() || m.booking_provider?.trim());
  const ig = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
  if (booking) s += 3;
  if (ig) s += 2;
  if (m.is_anchor) s += 2;
  const highDensity = (m.nearby_dora_licenses_total ?? 0) >= 10;
  const highBasePriority = (m.priority_score ?? 0) >= 6;
  if (highDensity || highBasePriority) s += 1;
  return s;
}

/** Mirrors `compareTopTargetRank` in marketsActiveRank for server/lib use. */
export function compareTopTargetRankForZoneOps(a: EnrichedBeautyZoneMember, b: EnrichedBeautyZoneMember): number {
  const score = (m: EnrichedBeautyZoneMember) => {
    const active = memberHasActivePresence(m);
    const hasBook = !!(m.booking_url?.trim() || m.booking_provider?.trim());
    const hasIg = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
    let s = 0;
    if (m.is_anchor && active) s += 500;
    if (hasBook) s += 120;
    if (m.is_anchor) s += 80;
    if (active) s += 60;
    if (hasIg) s += 40;
    s += m.upgraded_priority_score * 3;
    s += computeActiveRankScore(m);
    return s;
  };
  const c = score(b) - score(a);
  if (c !== 0) return c;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function deriveZoneOpsSummaries(
  members: EnrichedBeautyZoneMember[],
  clusters: BeautyZoneCluster[],
  zones: BeautyZone[]
): ZoneOpsSummary[] {
  const byZoneCluster = new Map<string, Set<string>>();
  for (const c of clusters) {
    if (!byZoneCluster.has(c.zone_id)) byZoneCluster.set(c.zone_id, new Set());
    byZoneCluster.get(c.zone_id)!.add(c.cluster_id);
  }

  return zones.map((z) => {
    const zm = membersInZone(members, z.zone_id);
    const clusterIds = byZoneCluster.get(z.zone_id);
    const clusterCount = clusterIds?.size ?? 0;

    let anchorCount = 0;
    let bookableCount = 0;
    let highPriorityCount = 0;
    let unresolvedCount = 0;
    let outreachReadyCount = 0;

    for (const m of zm) {
      if (m.is_anchor) anchorCount += 1;
      if (isBookable(m)) bookableCount += 1;
      if (m.upgraded_priority_score >= HIGH_PRIORITY_MIN) highPriorityCount += 1;
      if (m.upgraded_priority_score >= NEEDS_REVIEW_MIN && m.upgraded_priority_score <= NEEDS_REVIEW_MAX) {
        unresolvedCount += 1;
      }
      if (memberHasActivePresence(m)) outreachReadyCount += 1;
    }

    const topTargetIds = [...zm].sort(compareTopTargetRankForZoneOps).slice(0, 5).map((m) => m.location_id);

    return {
      zoneId: z.zone_id,
      zoneLabel: getZoneDisplayLabel(z.zone_id),
      totalMembers: zm.length,
      anchorCount,
      clusterCount,
      bookableCount,
      highPriorityCount,
      unresolvedCount,
      outreachReadyCount,
      topTargetIds,
    };
  });
}

export function getZoneOpsSummaryForId(summaries: ZoneOpsSummary[], zoneId: string): ZoneOpsSummary | undefined {
  return summaries.find((s) => s.zoneId === zoneId);
}

/** Client-side preset filter over already zone-scoped members (caller filters by zone first). */
export function filterMembersByWorkPreset(
  zoneMembers: EnrichedBeautyZoneMember[],
  preset: MarketsWorkPreset | null | undefined
): EnrichedBeautyZoneMember[] {
  if (!preset) return zoneMembers;
  switch (preset) {
    case "top_targets":
      return zoneMembers;
    case "anchors":
      return zoneMembers.filter((m) => m.is_anchor);
    case "clusters":
      return zoneMembers.filter((m) => m.cluster_size > 1 || m.in_largest_cluster);
    case "bookable":
      return zoneMembers.filter((m) => isBookable(m));
    case "needs_review":
      return zoneMembers.filter(
        (m) =>
          m.upgraded_priority_score >= NEEDS_REVIEW_MIN && m.upgraded_priority_score <= NEEDS_REVIEW_MAX
      );
    default:
      return zoneMembers;
  }
}
