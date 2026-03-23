/**
 * Zone-level operations summary for Markets — derived from enriched members + clusters.
 */

export type MarketsWorkPreset =
  | "top_targets"
  | "anchors"
  | "clusters"
  | "bookable"
  | "needs_review";

export const MARKETS_WORK_PRESETS: MarketsWorkPreset[] = [
  "top_targets",
  "anchors",
  "clusters",
  "bookable",
  "needs_review",
];

export interface ZoneOpsSummary {
  zoneId: string;
  zoneLabel: string;
  totalMembers: number;
  anchorCount: number;
  /** Distinct clusters in this zone (from cluster feed). */
  clusterCount: number;
  /** Members with booking URL or booking provider. */
  bookableCount: number;
  /** Strong upgraded score band (operator priority). */
  highPriorityCount: number;
  /** Cold / low-score band — needs discovery or qualification. */
  unresolvedCount: number;
  /** Has IG or booking (reachable / active presence). */
  outreachReadyCount: number;
  /** Top N location_ids by target rank for quick links. */
  topTargetIds: string[];
}
