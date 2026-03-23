/**
 * In-house build/survey signals for a zone (derived from loaded Markets JSON only).
 */

export interface ZoneBuildSummary {
  zoneId: string;
  zoneLabel: string;
  /** Member rows stitched into this zone listing. */
  stitchedMemberCount: number;
  /** Cluster records for this zone. */
  clusterSeedCount: number;
  /** Members with any DORA density total &gt; 0. */
  membersWithDoraSignalCount: number;
  /** Sum of nearby_dora_licenses_total across members (aggregate DORA exposure). */
  doraLicenseRefsTotal: number;
  /** Member rows that look Google-Places–sourced (`source` contains “google”, case-insensitive). */
  googleSourceMemberCount: number;
  /** Members without IG and without booking (cold / unstitched identity). */
  coldIdentityMemberCount: number;
  /** Gray-resolution rows explicitly not matched (when field present). */
  grayResolutionUnmatchedCount: number;
  /** Approved live units linked to this zone (if any). */
  approvedLiveUnitsInZoneCount: number;
  /** Short honest line for the panel. */
  narrativeLine: string;
}
