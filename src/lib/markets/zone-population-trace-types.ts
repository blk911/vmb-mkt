/**
 * Diagnostics: compare Live Units vs Markets population per zone (checkpoint counts).
 */

export interface ZonePopulationTrace {
  zoneId: string;
  /** Canonical TARGET_ZONES id (e.g. QUEBEC_CORRIDOR). */
  zoneCanonicalId: string;
  zoneLabel: string;
  /** CHECKPOINT A — hydrated Live Units rows whose zone matches (raw zone id normalized). */
  liveUnitsDatasetCount: number;
  /** CHECKPOINT B — subset with raw tuned/base score ≥ 70. */
  liveUnitsHighConfidenceCount: number;
  /** CHECKPOINT C — subset with raw score in 60–69. */
  liveUnitsExpansionCount: number;
  /** CHECKPOINT D — Markets enriched members in zone. */
  marketsMemberCount: number;
  /** CHECKPOINT E — approved live units file rows tied to zone (primary or linked). */
  operationalApprovedCount: number;
  /** CHECKPOINT F — from zone ops summary (same as Markets work packet stats). */
  anchorCount: number;
  clusterCount: number;
  diagnosis: string;
}
