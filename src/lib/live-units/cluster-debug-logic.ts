/**
 * Operator-facing cluster debug: counts, empty-state copy, fallback anchor hints.
 * Keeps presentation logic out of the cluster builder.
 */
import type { ClusterBuildDebug } from "./cluster-mode-types";

export type ClusterEmptyCase = "none" | "A_no_rows" | "B_no_anchors" | "C_anchors_no_related";

export type ClusterEmptyState = {
  case: ClusterEmptyCase;
  /** Primary explanation line for the empty / low-signal situation. */
  message: string;
  /** Secondary line (optional). */
  detail?: string;
  /** When true, show fallback anchor cards from debug.fallbackAnchors. */
  showFallbackAnchors: boolean;
};

/**
 * Derive empty-state messaging for Cluster Mode from build debug stats.
 */
export function deriveClusterEmptyState(debug: ClusterBuildDebug): ClusterEmptyState {
  const { rowsConsidered, anchorCandidatesFound, clustersFormed, totalRelatedRowsGrouped, fallbackAnchors } = debug;

  if (rowsConsidered === 0) {
    return {
      case: "A_no_rows",
      message:
        "No rows in scope for clustering. Adjust filters, switch to Review Mode, or clear the ZIP field to broaden the set.",
      showFallbackAnchors: false,
    };
  }

  if (anchorCandidatesFound === 0) {
    return {
      case: "B_no_anchors",
      message: "Rows are present, but no strong salon anchors were detected at the current thresholds.",
      detail:
        fallbackAnchors.length > 0
          ? "Below are the top scoring locations by anchor heuristic — they did not clear the anchor bar for grouping."
          : "Try widening geography filters or Rows view to inspect individual entities.",
      showFallbackAnchors: fallbackAnchors.length > 0,
    };
  }

  if (clustersFormed > 0 && totalRelatedRowsGrouped === 0) {
    return {
      case: "C_anchors_no_related",
      message:
        "Strong anchor candidates exist, but no related rows met conservative distance / relationship rules for this scope.",
      detail: "Clusters below list anchors only; grouping prefers under-linking to false positives.",
      showFallbackAnchors: false,
    };
  }

  return { case: "none", message: "", showFallbackAnchors: false };
}

export function formatClusterDebugLine(debug: ClusterBuildDebug): string {
  return `Rows considered: ${debug.rowsConsidered} · Anchor candidates: ${debug.anchorCandidatesFound} · Clusters formed: ${debug.clustersFormed} · Related rows grouped: ${debug.totalRelatedRowsGrouped}`;
}
