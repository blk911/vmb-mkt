/**
 * First failing checkpoint from ZonePopulationTrace → repair stage and operator guidance.
 */
import type { ZonePopulationTrace } from "@/lib/markets/zone-population-trace-types";
import type { ZoneRepairResult, ZoneRepairStage } from "@/lib/markets/zone-repair-types";

const RECOMMENDED: Record<Exclude<ZoneRepairStage, "markets_members_missing">, string> = {
  zone_assignment_missing:
    "No Live Units mapped. Verify zone geometry + normalizeZoneId + assignment logic.",
  live_units_not_promoted:
    "Live Units exist but not in Markets. Inspect member derivation and promotion rules.",
  anchors_missing:
    "Members exist but no anchors/clusters. Review anchor thresholds and clustering logic.",
  expansion_heavy:
    "Zone is mostly 60–69. Use IG/booking enrichment to promote candidates.",
  operational_gap:
    "Members exist but none approved. Inspect approval/promotion workflow.",
  healthy: "Zone population is consistent across pipeline.",
};

function summaryForStage(
  stage: ZoneRepairStage,
  t: ZonePopulationTrace
): string {
  switch (stage) {
    case "zone_assignment_missing":
      return `Checkpoint A: no Live Units rows for ${t.zoneLabel} (dataset count = 0).`;
    case "live_units_not_promoted":
      return `Checkpoints A–D: ${t.liveUnitsDatasetCount} Live Units row(s) in zone, but Markets members = 0.`;
    case "markets_members_missing":
      return `Markets member list empty for ${t.zoneLabel}.`;
    case "anchors_missing":
      return `Checkpoints D–F: ${t.marketsMemberCount} member(s) but anchors = ${t.anchorCount}, clusters = ${t.clusterCount}.`;
    case "expansion_heavy":
      return `Checkpoints B–C: high-confidence = 0, Expansion (60–69) = ${t.liveUnitsExpansionCount} in Live Units.`;
    case "operational_gap":
      return `Checkpoint E: ${t.marketsMemberCount} member(s) but approved live units tied to zone = 0.`;
    case "healthy":
      return `All evaluated checkpoints pass for ${t.zoneLabel}.`;
    default:
      return t.diagnosis;
  }
}

/**
 * Determines the first failing checkpoint in fixed order and returns stage + copy.
 * Order matches product spec (not the diagnostic prose order in zone-population-trace-logic).
 */
export function deriveZoneRepairResult(trace: ZonePopulationTrace): ZoneRepairResult {
  const zoneId = trace.zoneId;
  let stage: ZoneRepairStage;

  if (trace.liveUnitsDatasetCount === 0) {
    stage = "zone_assignment_missing";
  } else if (trace.liveUnitsDatasetCount > 0 && trace.marketsMemberCount === 0) {
    stage = "live_units_not_promoted";
  } else if (trace.marketsMemberCount > 0 && trace.anchorCount === 0 && trace.clusterCount === 0) {
    stage = "anchors_missing";
  } else if (trace.liveUnitsHighConfidenceCount === 0 && trace.liveUnitsExpansionCount > 0) {
    stage = "expansion_heavy";
  } else if (trace.operationalApprovedCount === 0 && trace.marketsMemberCount > 0) {
    stage = "operational_gap";
  } else {
    stage = "healthy";
  }

  let recommendedAction: string;
  if (stage === "markets_members_missing") {
    recommendedAction = "Inspect member JSON and zone_id alignment with catalog.";
  } else {
    recommendedAction = RECOMMENDED[stage];
  }

  return {
    zoneId,
    stage,
    summary: summaryForStage(stage, trace),
    recommendedAction,
  };
}
