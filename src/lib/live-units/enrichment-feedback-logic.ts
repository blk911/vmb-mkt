/**
 * Lightweight deterministic score nudges from existing row/signal fields only.
 * Used to reclassify Expansion (60–69) rows into High Confidence (≥70) in the UI when evidence supports it.
 *
 * Max boost is capped — this is not a second scoring engine; ingest/tuned scores remain authoritative on the server.
 */
import type { DerivedEntityDisplayState } from "./entity-display-types";
import type { PlatformSignalsRecord } from "./platform-signal-types";
import type { SurfacedOperator } from "./operator-extraction-types";
import type { EnrichmentFeedbackResult, EnrichmentUpgradeReason } from "./enrichment-feedback-types";
import {
  doraEvidenceTierForExpansion,
  hasBookingSignal,
  hasInstagramFromOperators,
  isClusterWeakIdentity,
  isExpansionScoreBand,
  type ExpansionLogicRow,
} from "./expansion-queue-logic";
import { getEffectiveScore } from "./work-mode-logic";

/** Total boost from feedback signals cannot exceed this (keeps nudges small). */
export const MAX_ENRICHMENT_FEEDBACK_BOOST = 10;

function hasBookablePlatformOnly(row: { platformSignals?: PlatformSignalsRecord | null }): boolean {
  const ps = row.platformSignals;
  if (!ps) return false;
  return !!(ps.fresha?.isBookable || ps.vagaro?.isBookable || ps.booksy?.isBookable || ps.glossgenius?.isBookable);
}

/**
 * Derives a feedback result for rows in the Expansion band (60–69) only; returns null otherwise.
 * Combines existing signals into a capped boost; `newScore` is used for layer filtering in the client.
 */
export function deriveEnrichmentFeedbackResult(
  row: ExpansionLogicRow,
  entityDisplay: DerivedEntityDisplayState,
  surfacedOperators: SurfacedOperator[],
  platformSignals?: PlatformSignalsRecord | null
): EnrichmentFeedbackResult | null {
  const oldScore = getEffectiveScore(row);
  if (!isExpansionScoreBand(oldScore)) return null;

  const ps: PlatformSignalsRecord | null | undefined = platformSignals ?? row.platformSignals;
  const rowWithPs = { ...row, platformSignals: ps };

  const reasons: EnrichmentUpgradeReason[] = [];
  let boost = 0;

  // +3 — IG evidence on surfaced operators (Tier A roster)
  if (hasInstagramFromOperators(surfacedOperators)) {
    boost += 3;
    reasons.push("ig_found");
  }

  // +3 — booking hint or bookable platform listing
  if (hasBookingSignal(rowWithPs, entityDisplay)) {
    boost += 3;
    reasons.push("booking_found");
  } else if (hasBookablePlatformOnly(rowWithPs)) {
    // Rare: bookable without hint text — still count as platform confirmation
    boost += 2;
    reasons.push("platform_confirmed");
  }

  // +2 — stronger DORA / location anchoring (tier ≥2)
  if (doraEvidenceTierForExpansion(row) >= 2) {
    boost += 2;
    reasons.push("location_confirmed");
  }

  // +2 — identity not in weakest bucket
  if (!isClusterWeakIdentity(entityDisplay)) {
    boost += 2;
    reasons.push("identity_strengthened");
  }

  // +2 — at least one validated surfaced operator (business-anchored roster)
  if (surfacedOperators.length > 0) {
    boost += 2;
    reasons.push("operator_linked");
  }

  boost = Math.min(MAX_ENRICHMENT_FEEDBACK_BOOST, boost);
  const newScore = Math.min(100, oldScore + boost);
  const upgraded = newScore > oldScore;
  const movedToHighConfidence = oldScore < 70 && newScore >= 70;

  return {
    liveUnitId: row.live_unit_id,
    upgraded,
    oldScore,
    newScore,
    boost: newScore - oldScore,
    reasons,
    movedToHighConfidence,
  };
}

/**
 * Score used for High / Expansion / All layer toggles. Applies feedback nudge only when raw score is in 60–69.
 */
export function getFeedbackAdjustedScoreForLayer(
  row: ExpansionLogicRow,
  entityDisplay: DerivedEntityDisplayState,
  surfacedOperators: SurfacedOperator[]
): number {
  const base = getEffectiveScore(row);
  if (!isExpansionScoreBand(base)) return base;
  const fb = deriveEnrichmentFeedbackResult(row, entityDisplay, surfacedOperators, row.platformSignals);
  return fb ? fb.newScore : base;
}

export function isUpgradeableByFeedback(row: ExpansionLogicRow, entityDisplay: DerivedEntityDisplayState, ops: SurfacedOperator[]): boolean {
  const fb = deriveEnrichmentFeedbackResult(row, entityDisplay, ops, row.platformSignals);
  return !!fb?.upgraded;
}

export function wouldMoveToHighConfidenceByFeedback(
  row: ExpansionLogicRow,
  entityDisplay: DerivedEntityDisplayState,
  ops: SurfacedOperator[]
): boolean {
  const fb = deriveEnrichmentFeedbackResult(row, entityDisplay, ops, row.platformSignals);
  return !!fb?.movedToHighConfidence;
}
