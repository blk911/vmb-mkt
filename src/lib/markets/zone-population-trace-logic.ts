/**
 * Derives per-zone checkpoint counts to locate where new zones drop out (config vs Live Units vs Markets).
 */
import { getZoneDisplayLabel, normalizeZoneId } from "@/lib/geo/target-zones";
import type { ApprovedLiveUnit, EnrichedBeautyZoneMember } from "@/lib/markets";
import { getEffectiveScore, getZoneId, type WorkModeRow } from "@/lib/live-units/work-mode-logic";
import { isExpansionScoreBand } from "@/lib/live-units/expansion-queue-logic";
import type { ZoneOpsSummary } from "@/lib/markets/zone-ops-types";
import type { ZonePopulationTrace } from "./zone-population-trace-types";

/** Canonical ids for Quebec / Westminster / Lafayette (matches TARGET_ZONES + ingest aliases). */
export const TRACE_ZONE_CANONICAL_IDS = ["QUEBEC_CORRIDOR", "WESTMINSTER_CORE", "LAFAYETTE_CORE"] as const;

export type LiveUnitRowForTrace = WorkModeRow & {
  live_unit_id: string;
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string };
  };
};

function zoneMatchesRow(row: LiveUnitRowForTrace, canonical: string): boolean {
  const gid = getZoneId(row);
  if (gid === "NO_ZONE") return false;
  return normalizeZoneId(gid) === normalizeZoneId(canonical);
}

function approvedTouchesZone(a: ApprovedLiveUnit, canonical: string): boolean {
  const c = normalizeZoneId(canonical);
  if (a.primary_zone_id && normalizeZoneId(a.primary_zone_id) === c) return true;
  return (a.linked_zones ?? []).some((l) => normalizeZoneId(l.zone_id) === c);
}

function memberInZone(m: EnrichedBeautyZoneMember, canonical: string): boolean {
  return normalizeZoneId(m.zone_id) === normalizeZoneId(canonical);
}

function deriveDiagnosis(t: Omit<ZonePopulationTrace, "diagnosis">): string {
  const { liveUnitsDatasetCount, liveUnitsHighConfidenceCount, marketsMemberCount, anchorCount, clusterCount, operationalApprovedCount } =
    t;

  if (liveUnitsDatasetCount === 0 && marketsMemberCount === 0) {
    return "Zone is in config/catalog, but no Live Units rows and no Markets members reference this zone yet (no processed population).";
  }
  if (liveUnitsDatasetCount === 0 && marketsMemberCount > 0) {
    return "Markets has members while Live Units shows no rows for this zone — check zone_id assignment vs ingest (possible ID mismatch).";
  }
  if (liveUnitsDatasetCount > 0 && marketsMemberCount === 0) {
    return "Live Units has rows for this zone, but Markets member list is empty — promotion/stitch from Live Units → members has not run for this zone.";
  }
  if (marketsMemberCount > 0 && anchorCount === 0 && clusterCount === 0) {
    return "Markets members exist, but anchors/clusters are zero — cluster build or ops rollup may still be pending for this zone.";
  }
  if (liveUnitsHighConfidenceCount === 0 && liveUnitsDatasetCount > 0) {
    return "Rows exist in-zone but none are in the raw ≥70 band — many may still be in Expansion (60–69) or lower.";
  }
  if (operationalApprovedCount === 0 && liveUnitsDatasetCount > 0) {
    return "Live Units has in-zone rows but approved-live-units file has none tied here — approval/stitch pipeline gap.";
  }
  return "Zone is partially populated; compare High vs Expansion counts and Markets ops for next enrichment step.";
}

/**
 * Build trace rows for the default three target zones (Quebec, Westminster, Lafayette).
 */
export function buildZonePopulationTraces(input: {
  liveUnitRows: LiveUnitRowForTrace[];
  members: EnrichedBeautyZoneMember[];
  approvedLiveUnits: ApprovedLiveUnit[];
  zoneSummaries: ZoneOpsSummary[];
  /** Defaults to Quebec / Westminster / Lafayette canonical ids. */
  targetCanonicalIds?: readonly string[];
}): ZonePopulationTrace[] {
  const ids = input.targetCanonicalIds ?? TRACE_ZONE_CANONICAL_IDS;

  return ids.map((canonical) => {
    const zoneLabel = getZoneDisplayLabel(canonical);

    let liveUnitsDatasetCount = 0;
    let liveUnitsHighConfidenceCount = 0;
    let liveUnitsExpansionCount = 0;

    for (const row of input.liveUnitRows) {
      if (!zoneMatchesRow(row, canonical)) continue;
      liveUnitsDatasetCount += 1;
      const s = getEffectiveScore(row);
      if (s >= 70) liveUnitsHighConfidenceCount += 1;
      else if (isExpansionScoreBand(s)) liveUnitsExpansionCount += 1;
    }

    const marketsMemberCount = input.members.filter((m) => memberInZone(m, canonical)).length;

    let operationalApprovedCount = 0;
    for (const a of input.approvedLiveUnits) {
      if (approvedTouchesZone(a, canonical)) operationalApprovedCount += 1;
    }

    const summary = input.zoneSummaries.find((s) => normalizeZoneId(s.zoneId) === normalizeZoneId(canonical));

    const anchorCount = summary?.anchorCount ?? 0;
    const clusterCount = summary?.clusterCount ?? 0;

    const base: Omit<ZonePopulationTrace, "diagnosis"> = {
      zoneId: summary?.zoneId ?? canonical,
      zoneCanonicalId: canonical,
      zoneLabel,
      liveUnitsDatasetCount,
      liveUnitsHighConfidenceCount,
      liveUnitsExpansionCount,
      marketsMemberCount,
      operationalApprovedCount,
      anchorCount,
      clusterCount,
    };

    return {
      ...base,
      diagnosis: deriveDiagnosis(base),
    };
  });
}
