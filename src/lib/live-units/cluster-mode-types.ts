/**
 * Conservative salon-anchor cluster view for Live Units (operator-facing, not entity resolution).
 */

export type ClusterStrength = "high" | "medium" | "low";

/** Evidence tags for why a row is grouped with an anchor (hints only). */
export type ClusterReasonTag =
  | "same_building"
  | "service_overlap"
  | "tech_near_salon"
  | "shared_name"
  | "validated_operator_overlap"
  | "same_zone"
  | "suite_or_tech_context";

export interface ClusterAnchorCandidate {
  unitId: string;
  anchorScore: number;
}

export interface RelatedRowMatch {
  unitId: string;
  relationshipScore: number;
  reasonTags: ClusterReasonTag[];
}

export interface SalonAnchorCluster {
  anchorUnitId: string;
  anchorScore: number;
  clusterStrength: ClusterStrength;
  relatedUnitIds: string[];
  relatedMatches: RelatedRowMatch[];
  validatedOperatorCount: number;
  platformSignalCount: number;
  serviceSignals: string[];
  zoneId: string | null;
  operatorSummary: string;
}

/** Minimal row fields used by cluster heuristics (matches Live Unit rows). */
export type ClusterModeRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  signal_mix: string;
  explanation?: string;
  city?: string | null;
  zip?: string | null;
  shop_license?: string | null;
  shop_license_name?: string | null;
  tech_count_nearby?: number;
  lat?: number | null;
  lon?: number | null;
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string; website_domain?: string };
  };
  platformSignals?: import("./platform-signal-types").PlatformSignalsRecord | null;
};
