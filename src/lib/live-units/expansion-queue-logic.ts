/**
 * Queue B (Expansion Layer): score 60–69 — zone expansion & signal enrichment (not primary review).
 */
import type { PlatformSignalsRecord } from "./platform-signal-types";
import type { DerivedEntityDisplayState } from "./entity-display-types";
import type { SurfacedOperator } from "./operator-extraction-types";
import { getEffectiveScore, getZoneId, getZoneName, type WorkModeRow } from "./work-mode-logic";

/** Row fields used by expansion / DORA tier (compatible with LiveUnitsClient row). */
export type ExpansionLogicRow = WorkModeRow & {
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string; website_domain?: string; id?: string; name?: string; address?: string };
    dora?: { license_row_ids?: string[]; address_key?: string };
  };
  dora_license_id?: string | null;
  shop_license?: string | null;
  tech_count_nearby?: number | null;
};

export type ScoreLayerFilter = "high_confidence" | "expansion" | "all";

export function isExpansionScoreBand(score: number): boolean {
  return score >= 60 && score < 70;
}

export function matchesScoreLayer(score: number, layer: ScoreLayerFilter): boolean {
  if (layer === "high_confidence") return score >= 70;
  if (layer === "expansion") return isExpansionScoreBand(score);
  return true;
}

function linkedGooglePresent(row: ExpansionLogicRow): boolean {
  return !!row.raw_snippets?.google;
}

function linkedDoraCount(row: ExpansionLogicRow): number {
  const ids = row.raw_snippets?.dora?.license_row_ids;
  if (Array.isArray(ids) && ids.length > 0) return ids.length;
  return row.dora_license_id ? 1 : 0;
}

function hasDoraSignal(row: ExpansionLogicRow): boolean {
  return linkedDoraCount(row) > 0 || !!row.shop_license?.trim();
}

/** DORA evidence tier 0–3 — mirrors LiveUnitsClient doraEvidenceTier. */
export function doraEvidenceTierForExpansion(row: ExpansionLogicRow): number {
  const linked = linkedDoraCount(row);
  const shop = row.shop_license;
  if (linked > 0 && shop) return 3;
  if (linked > 0 || row.dora_license_id) return 2;
  if (shop || (row.tech_count_nearby ?? 0) > 0 || row.signal_mix.includes("dora")) return 1;
  return 0;
}

export function hasInstagramFromOperators(operators: SurfacedOperator[]): boolean {
  return operators.some((o) => !!o.instagramHandle?.trim());
}

function hasBookablePlatform(row: { platformSignals?: PlatformSignalsRecord | null }): boolean {
  const ps = row.platformSignals;
  if (!ps) return false;
  return !!(ps.fresha?.isBookable || ps.vagaro?.isBookable || ps.booksy?.isBookable || ps.glossgenius?.isBookable);
}

export function hasBookingSignal(
  row: { platformSignals?: PlatformSignalsRecord | null },
  entityDisplay: Pick<DerivedEntityDisplayState, "bookingPlatformHint">
): boolean {
  if (entityDisplay.bookingPlatformHint) return true;
  return hasBookablePlatform(row);
}

export function isClusterWeakIdentity(entityDisplay: Pick<DerivedEntityDisplayState, "entityKind" | "relationshipHint">): boolean {
  if (entityDisplay.entityKind === "unknown") return true;
  if (entityDisplay.relationshipHint === "standalone_unknown") return true;
  return false;
}

export function deriveNextSignalNeeded(
  row: ExpansionLogicRow,
  entityDisplay: DerivedEntityDisplayState,
  surfacedOperators: SurfacedOperator[]
): string {
  const score = getEffectiveScore(row);
  if (!isExpansionScoreBand(score)) return "";

  const hasIg = hasInstagramFromOperators(surfacedOperators);
  const hasBooking = hasBookingSignal(row, entityDisplay);
  const tier = doraEvidenceTierForExpansion(row);
  const weakCluster = isClusterWeakIdentity(entityDisplay);
  const conf = row.tuned_confidence || row.confidence;

  if (!hasIg) return "Find IG";
  if (!hasBooking) return "Check booking";
  if (tier <= 1) return "Verify location";
  if (weakCluster || conf === "ambiguous") return "Resolve identity";
  return "Promote candidate";
}

export function needsIGEnrichment(row: ExpansionLogicRow, surfacedOperators: SurfacedOperator[]): boolean {
  const score = getEffectiveScore(row);
  if (!isExpansionScoreBand(score)) return false;
  if (hasInstagramFromOperators(surfacedOperators)) return false;
  const hasCore = linkedGooglePresent(row) || hasDoraSignal(row);
  return hasCore;
}

export type ZoneExpansionSummaryRow = {
  zoneId: string;
  zoneName: string;
  expansionCount: number;
  highConfidenceCount: number;
  /** Raw 60–69 rows where feedback adds any positive boost (optional; 0 if not computed). */
  upgradeableCount: number;
};

export type BuildZoneExpansionSummaryOptions = {
  /** Score used for expansion vs high bins (defaults to tuned/base effective score). */
  layerScore?: (row: ExpansionLogicRow) => number;
  /** Count per zone when true (e.g. feedback upgradeable). */
  countUpgradeable?: (row: ExpansionLogicRow) => boolean;
};

export function buildZoneExpansionSummary(
  allRows: ExpansionLogicRow[],
  options?: BuildZoneExpansionSummaryOptions
): ZoneExpansionSummaryRow[] {
  const layerScore = options?.layerScore ?? getEffectiveScore;
  const countUpgradeable = options?.countUpgradeable;

  const byZone = new Map<
    string,
    { zoneName: string; expansionCount: number; highConfidenceCount: number; upgradeableCount: number; sample: WorkModeRow }
  >();

  for (const row of allRows) {
    const zid = getZoneId(row);
    const score = layerScore(row);
    const exp = score >= 60 && score < 70;
    const high = score >= 70;

    if (!byZone.has(zid)) {
      byZone.set(zid, {
        zoneName: getZoneName(row),
        expansionCount: 0,
        highConfidenceCount: 0,
        upgradeableCount: 0,
        sample: row,
      });
    }
    const rec = byZone.get(zid)!;
    if (exp) rec.expansionCount += 1;
    if (high) rec.highConfidenceCount += 1;
    if (countUpgradeable?.(row)) rec.upgradeableCount += 1;
  }

  return [...byZone.entries()]
    .map(([zoneId, v]) => ({
      zoneId,
      zoneName: v.zoneName,
      expansionCount: v.expansionCount,
      highConfidenceCount: v.highConfidenceCount,
      upgradeableCount: v.upgradeableCount,
    }))
    .sort((a, b) => a.zoneName.localeCompare(b.zoneName, undefined, { sensitivity: "base" }));
}
