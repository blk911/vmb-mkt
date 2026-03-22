import type { BeautyZoneCluster, EnrichedBeautyZoneMember } from "@/lib/markets";

import { memberHasActivePresence } from "./marketsActiveRank";

/** UI-only cluster presence / opportunity metrics (does not mutate JSON). */
export type ClusterActiveMetrics = {
  cluster_active_score: number;
  /** Members with IG URL/handle or booking_provider (reviewer “active”). */
  active_member_count: number;
  /** Members in this cluster (same as zone JSON rows for cluster_id). */
  total_member_count: number;
  /** Members with non-empty booking_provider. */
  booking_member_count: number;
  /** Members with instagram_url or instagram_handle. */
  instagram_member_count: number;
  /** Members with path_enrichment_matched (supplemental merge). */
  path_enriched_member_count: number;
  /** Members with gray_resolution_matched (supplemental gray-pin merge). */
  resolved_member_count: number;
  /** Members with no core IG/booking presence (weak / missing primary signals). */
  unresolved_member_count: number;
  /**
   * Opportunity signal: booking×3 + IG×1 + path×2 + unresolved×1 + resolved×1.
   * UI-only; not stored on cluster JSON.
   */
  cluster_opportunity_score: number;
  /**
   * Underrepresented primary signals but path recovery suggests activity:
   * active &lt; 50% of members and at least 2 path-enriched members.
   */
  is_hidden_opportunity: boolean;
  cluster_distinct_booking_providers: string[];
  has_anchor: boolean;
};

function distinctBookingProviders(mems: EnrichedBeautyZoneMember[]): string[] {
  return [
    ...new Set(mems.map((m) => m.booking_provider?.trim()).filter((x): x is string => !!x && x.length > 0)),
  ].sort((a, b) => a.localeCompare(b));
}

/**
 * Additive cluster score:
 * +3 per member with booking_provider, +1 per member with IG,
 * +2 if any anchor, +1 if member_count >= 5, +1 if >1 distinct booking provider.
 */
export function computeClusterActiveMetrics(
  cluster: BeautyZoneCluster,
  mems: EnrichedBeautyZoneMember[]
): ClusterActiveMetrics {
  const cluster_distinct_booking_providers = distinctBookingProviders(mems);
  let score = 0;
  let booking_member_count = 0;
  let instagram_member_count = 0;

  for (const m of mems) {
    if (m.booking_provider?.trim()) {
      score += 3;
      booking_member_count += 1;
    }
    if (m.instagram_url?.trim() || m.instagram_handle?.trim()) {
      score += 1;
      instagram_member_count += 1;
    }
  }

  const has_anchor = mems.some((m) => m.is_anchor);
  if (has_anchor) score += 2;
  if (cluster.member_count >= 5) score += 1;
  if (cluster_distinct_booking_providers.length > 1) score += 1;

  const active_member_count = mems.filter(memberHasActivePresence).length;
  const total_member_count = mems.length;
  let path_enriched_member_count = 0;
  let resolved_member_count = 0;
  let unresolved_member_count = 0;
  for (const m of mems) {
    if (m.path_enrichment_matched === true) path_enriched_member_count += 1;
    if (m.gray_resolution_matched === true) resolved_member_count += 1;
    if (!memberHasActivePresence(m)) unresolved_member_count += 1;
  }

  const cluster_opportunity_score =
    booking_member_count * 3 +
    instagram_member_count * 1 +
    path_enriched_member_count * 2 +
    unresolved_member_count * 1 +
    resolved_member_count * 1;

  const is_hidden_opportunity =
    total_member_count > 0 &&
    active_member_count < total_member_count * 0.5 &&
    path_enriched_member_count >= 2;

  return {
    cluster_active_score: score,
    active_member_count,
    total_member_count,
    booking_member_count,
    instagram_member_count,
    path_enriched_member_count,
    resolved_member_count,
    unresolved_member_count,
    cluster_opportunity_score,
    is_hidden_opportunity,
    cluster_distinct_booking_providers,
    has_anchor,
  };
}

/** First anchor name, else first top_member_names entry, else cluster label. */
export function clusterDisplayTitle(cluster: BeautyZoneCluster, mems: EnrichedBeautyZoneMember[]): string {
  const anchor = mems.find((m) => m.is_anchor);
  if (anchor?.name?.trim()) return anchor.name.trim();
  const top = cluster.top_member_names[0]?.trim();
  if (top) return top;
  return `Cluster #${cluster.cluster_rank}`;
}
