import type { BeautyZoneCluster, EnrichedBeautyZoneMember } from "@/lib/markets";

import { memberHasActivePresence } from "./marketsActiveRank";

/** UI-only cluster presence / opportunity metrics (does not mutate JSON). */
export type ClusterActiveMetrics = {
  cluster_active_score: number;
  /** Members with IG URL/handle or booking_provider (reviewer “active”). */
  active_member_count: number;
  /** Members with non-empty booking_provider. */
  booking_member_count: number;
  /** Members with instagram_url or instagram_handle. */
  instagram_member_count: number;
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

  return {
    cluster_active_score: score,
    active_member_count,
    booking_member_count,
    instagram_member_count,
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
