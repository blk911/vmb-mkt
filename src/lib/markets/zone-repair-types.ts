/**
 * Trace-driven repair stage for zone population (first failing checkpoint → action).
 */

export type ZoneRepairStage =
  | "zone_assignment_missing"
  | "live_units_not_promoted"
  | "markets_members_missing"
  | "anchors_missing"
  | "expansion_heavy"
  | "operational_gap"
  | "healthy";

export interface ZoneRepairResult {
  zoneId: string;
  stage: ZoneRepairStage;
  summary: string;
  recommendedAction: string;
}
