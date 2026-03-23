/**
 * Deterministic Work Mode rules over Live Units rows.
 * Maps to fields present on live unit rows (operational_category, zone_id, scores, signal_mix, etc.).
 *
 * Priority / next-action are operator hints only — not persisted.
 */
import { getZoneDisplayLabel, isActiveOperationalZoneId, normalizeZoneId } from "@/lib/geo/target-zones";
import {
  WORK_PRESETS,
  type WorkDerivedState,
  type WorkNextAction,
  type WorkPresetId,
  type WorkPriority,
  type WorkPresetMeta,
} from "./work-mode-types";
import { deriveEntityDisplayStateForRow, type EntityDisplayRowInput } from "./entity-display-logic";
import { getSurfacedOperatorCount } from "./operator-extraction-logic";
import { deriveServiceSignalsForRow, isNailsCategoryString } from "./service-signal-logic";
import type { PlatformSignalsRecord } from "./platform-signal-types";

export type ReviewStatusLite = "approved" | "rejected" | "watch" | "needs_research" | undefined;

/** Minimal row shape for work logic (compatible with LiveUnitsClient row). */
export type WorkModeRow = {
  live_unit_id: string;
  operational_category: string;
  subtype?: string;
  /** Used with category/signal_mix to derive nail-led service signals (mixed beauty, etc.). */
  name_display?: string;
  explanation?: string;
  entity_score: number;
  tuned_entity_score?: number;
  signal_mix: string;
  confidence: string;
  tuned_confidence?: string;
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string; website_domain?: string };
  };
  shop_license?: string | null;
  /** Shop / business name when anchored (helps entity-first salon detection). */
  shop_license_name?: string | null;
  tech_count_nearby?: number;
  /** High-confidence booking platform signals attached to this entity only (never create-from-platform). */
  platformSignals?: PlatformSignalsRecord | null;
};

function toEntityDisplayInput(row: WorkModeRow): EntityDisplayRowInput {
  return {
    operational_category: row.operational_category,
    subtype: row.subtype,
    signal_mix: row.signal_mix,
    name_display: row.name_display,
    explanation: row.explanation,
    shop_license: row.shop_license,
    shop_license_name: row.shop_license_name,
    tech_count_nearby: row.tech_count_nearby,
    entity_score: row.entity_score,
    tuned_entity_score: row.tuned_entity_score,
    confidence: row.confidence,
    tuned_confidence: row.tuned_confidence,
    raw_snippets: row.raw_snippets,
    platformSignals: row.platformSignals,
  };
}

/** True when derived signals include nails (not rigid category-only). */
export function rowHasNailsLedSignal(row: WorkModeRow): boolean {
  return deriveServiceSignalsForRow({
    operational_category: row.operational_category,
    subtype: row.subtype,
    signal_mix: row.signal_mix,
    name_display: row.name_display,
    explanation: row.explanation,
  }).hasNails;
}

export function getEffectiveScore(row: WorkModeRow): number {
  return typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score;
}

/** Small additive boost per bookable platform (capped) — does not replace core scoring. */
export const PLATFORM_BOOKING_BOOST_PER_SIGNAL = 2;
export const PLATFORM_BOOKING_BOOST_MAX = 4;

export function platformBookingBoostScore(row: WorkModeRow): number {
  const ps = row.platformSignals;
  if (!ps) return 0;
  let n = 0;
  for (const p of ["fresha", "vagaro", "booksy", "glossgenius"] as const) {
    if (ps[p]?.isBookable) n += 1;
  }
  return Math.min(n * PLATFORM_BOOKING_BOOST_PER_SIGNAL, PLATFORM_BOOKING_BOOST_MAX);
}

/** Score used for Work Mode priority tiers — includes small platform booking boost. */
export function adjustedScoreForWorkMode(row: WorkModeRow): number {
  return getEffectiveScore(row) + platformBookingBoostScore(row);
}

function rowHasAnyBookablePlatform(row: WorkModeRow): boolean {
  const ps = row.platformSignals;
  if (!ps) return false;
  return !!(ps.fresha?.isBookable || ps.vagaro?.isBookable || ps.booksy?.isBookable || ps.glossgenius?.isBookable);
}

/**
 * When a validated booking platform signal exists, prefer outreach over open-ended research
 * (simple refinement — does not override reject/skip).
 */
export function refineNextActionForPlatformSignals(row: WorkModeRow, action: WorkNextAction): WorkNextAction {
  if (action !== "research") return action;
  if (!rowHasAnyBookablePlatform(row)) return action;
  if (hasWebsiteSignal(row)) return "dm";
  return "review";
}

export function getZoneId(row: WorkModeRow): string {
  return row.raw_snippets?.google?.zone_id || "NO_ZONE";
}

export function getZoneName(row: WorkModeRow): string {
  const id = row.raw_snippets?.google?.zone_id;
  if (id) return getZoneDisplayLabel(id);
  const nm = row.raw_snippets?.google?.zone_name;
  if (nm) return getZoneDisplayLabel(nm);
  return "No zone";
}

function canonicalZoneId(row: WorkModeRow): string {
  const raw = getZoneId(row);
  if (raw === "NO_ZONE") return raw;
  return normalizeZoneId(raw);
}

/** Category-string nails heuristic (legacy / diagnostics). Prefer {@link rowHasNailsLedSignal} for presets. */
export function isNailsRelatedCategory(operationalCategory: string): boolean {
  return isNailsCategoryString(operationalCategory);
}

function getEffectiveConfidence(row: WorkModeRow): string {
  return row.tuned_confidence || row.confidence;
}

function hasWebsiteSignal(row: WorkModeRow): boolean {
  const domain = row.raw_snippets?.google?.website_domain?.trim();
  if (domain) return true;
  const mix = row.signal_mix.toLowerCase();
  return mix.includes("google") && (mix.includes("website") || mix.includes("site"));
}

function isDenseNeighborSignal(row: WorkModeRow): boolean {
  const t = row.tech_count_nearby ?? 0;
  if (t >= 2) return true;
  if ((row.subtype || "").toLowerCase() === "storefront") return true;
  const mix = row.signal_mix.toLowerCase();
  return mix.includes("dora") && (t > 0 || !!row.shop_license);
}

function isRejected(rs: ReviewStatusLite): boolean {
  return rs === "rejected";
}

function isUnreviewed(rs: ReviewStatusLite): boolean {
  return rs === undefined;
}

/** Strict preset match (no score/zone broadening). Exported for diagnostics. */
export function rowMatchesPresetStrict(row: WorkModeRow, presetId: WorkPresetId, reviewStatus: ReviewStatusLite): boolean {
  const score = getEffectiveScore(row);
  const z = canonicalZoneId(row);
  const nailsLed = rowHasNailsLedSignal(row);
  const conf = getEffectiveConfidence(row);

  switch (presetId) {
    case "QUEBEC_HIGH_VALUE":
      if (!nailsLed) return false;
      if (z !== "QUEBEC_CORRIDOR") return false;
      if (score < 70) return false;
      if (isRejected(reviewStatus)) return false;
      return true;

    case "DOWNTOWN_DENSE":
      if (!nailsLed) return false;
      if (z !== "DOWNTOWN_CORE") return false;
      if (score < 60) return false;
      if (isRejected(reviewStatus)) return false;
      return isDenseNeighborSignal(row);

    case "BOOKING_READY":
      if (!nailsLed) return false;
      if (score < 65) return false;
      if (isRejected(reviewStatus)) return false;
      return hasWebsiteSignal(row);

    case "NEEDS_REVIEW":
      if (isRejected(reviewStatus)) return false;
      if (score >= 40 && score <= 69) return true;
      if (conf === "candidate_review" || conf === "ambiguous") return true;
      return false;

    case "NEW_LEADS":
      return isUnreviewed(reviewStatus);

    default:
      return true;
  }
}

/** Alias for strict match — used for “matches preset” badges and diagnostics. */
export function rowMatchesPreset(row: WorkModeRow, presetId: WorkPresetId, reviewStatus: ReviewStatusLite): boolean {
  return rowMatchesPresetStrict(row, presetId, reviewStatus);
}

function matchQuebecLoose(row: WorkModeRow, rs: ReviewStatusLite, minScore: number): boolean {
  if (!rowHasNailsLedSignal(row)) return false;
  if (canonicalZoneId(row) !== "QUEBEC_CORRIDOR") return false;
  if (isRejected(rs)) return false;
  return getEffectiveScore(row) >= minScore;
}

function matchQuebecBroad(row: WorkModeRow, rs: ReviewStatusLite): boolean {
  if (!rowHasNailsLedSignal(row)) return false;
  if (canonicalZoneId(row) !== "QUEBEC_CORRIDOR") return false;
  return !isRejected(rs);
}

function matchDowntownLoose(row: WorkModeRow, rs: ReviewStatusLite, minScore: number, requireDense: boolean): boolean {
  if (!rowHasNailsLedSignal(row)) return false;
  if (canonicalZoneId(row) !== "DOWNTOWN_CORE") return false;
  if (isRejected(rs)) return false;
  if (getEffectiveScore(row) < minScore) return false;
  if (requireDense) return isDenseNeighborSignal(row);
  return true;
}

function matchBookingLoose(row: WorkModeRow, rs: ReviewStatusLite, minScore: number): boolean {
  if (!rowHasNailsLedSignal(row)) return false;
  if (isRejected(rs)) return false;
  if (getEffectiveScore(row) < minScore) return false;
  return hasWebsiteSignal(row);
}

/**
 * Apply preset with resilience: if strict match yields &lt; 3 rows, broaden thresholds (deterministic tiers).
 * NEW_LEADS / NEEDS_REVIEW: strict only.
 */
export function applyWorkPreset<T extends WorkModeRow>(
  rows: T[],
  presetId: WorkPresetId,
  getReviewStatus: (liveUnitId: string) => ReviewStatusLite
): T[] {
  const g = (row: T) => getReviewStatus(row.live_unit_id);

  const strict = rows.filter((row) => rowMatchesPresetStrict(row, presetId, g(row)));
  if (presetId === "NEW_LEADS" || presetId === "NEEDS_REVIEW") {
    return strict;
  }
  if (strict.length >= 3) {
    return strict;
  }

  if (presetId === "QUEBEC_HIGH_VALUE") {
    const t2 = rows.filter((row) => matchQuebecLoose(row, g(row), 60));
    if (t2.length >= 3 || (t2.length > 0 && strict.length === 0)) return t2.length ? t2 : strict;
    const t3 = rows.filter((row) => matchQuebecBroad(row, g(row)));
    return t3.length ? t3 : t2.length ? t2 : strict;
  }

  if (presetId === "DOWNTOWN_DENSE") {
    const t1 = rows.filter((row) => matchDowntownLoose(row, g(row), 60, false));
    if (t1.length >= 3 || (t1.length > 0 && strict.length === 0)) return t1.length ? t1 : strict;
    const t2 = rows.filter((row) => matchDowntownLoose(row, g(row), 55, false));
    return t2.length ? t2 : t1.length ? t1 : strict;
  }

  if (presetId === "BOOKING_READY") {
    const t1 = rows.filter((row) => matchBookingLoose(row, g(row), 60));
    if (t1.length >= 3 || (t1.length > 0 && strict.length === 0)) return t1.length ? t1 : strict;
    const t2 = rows.filter((row) => matchBookingLoose(row, g(row), 55));
    return t2.length ? t2 : t1.length ? t1 : strict;
  }

  return strict;
}

/** Pick default preset: Quebec high-value if enough matches, else new leads. */
export function pickDefaultWorkPreset<T extends WorkModeRow>(
  rows: T[],
  getReviewStatus: (liveUnitId: string) => ReviewStatusLite
): WorkPresetId {
  const quebec = applyWorkPreset(rows, "QUEBEC_HIGH_VALUE", getReviewStatus);
  return quebec.length >= 2 ? "QUEBEC_HIGH_VALUE" : "NEW_LEADS";
}

export type WorkSummaryCounts = {
  highPriority: number;
  readyToWork: number;
  needsReview: number;
  inActiveZone: number;
};

export function summarizeWorkMode<T extends WorkModeRow>(
  rows: T[],
  getReviewStatus: (liveUnitId: string) => ReviewStatusLite
): WorkSummaryCounts {
  let highPriority = 0;
  let readyToWork = 0;
  let needsReview = 0;
  let inActiveZone = 0;

  for (const row of rows) {
    const d = deriveWorkStateForRow(row, getReviewStatus(row.live_unit_id), null);
    if (d.priority === "high") highPriority += 1;
    if (d.priority === "ready") readyToWork += 1;
    if (d.priority === "review") needsReview += 1;
    if (isActiveOperationalZoneId(getZoneId(row))) inActiveZone += 1;
  }

  return { highPriority, readyToWork, needsReview, inActiveZone };
}

/**
 * Priority (v1):
 * - high: nails, score>=70, target zone, not rejected, not approved
 * - ready: nails, score>=65, actionable signal (web/dense/shop)
 * - review: mid score 40–69 or candidate/ambiguous confidence
 * - low: everything else (non-nails or weak)
 */
export function derivePriority(row: WorkModeRow, reviewStatus: ReviewStatusLite): WorkPriority {
  const score = adjustedScoreForWorkMode(row);
  const nailsLed = rowHasNailsLedSignal(row);
  const z = getZoneId(row);
  const conf = getEffectiveConfidence(row);
  const entity = deriveEntityDisplayStateForRow(toEntityDisplayInput(row));

  if (isRejected(reviewStatus)) return "low";

  if (
    nailsLed &&
    score >= 70 &&
    ACTIVE_ZONE_IDS.has(z) &&
    reviewStatus !== "approved"
  ) {
    return "high";
  }

  /** Entity-first boost: multi-tech salon / mixed nail-led location in an active zone. */
  if (
    nailsLed &&
    score >= 68 &&
    ACTIVE_ZONE_IDS.has(z) &&
    reviewStatus !== "approved" &&
    entity.likelyLive &&
    (entity.entityKind === "salon" || entity.entityKind === "mixed_business") &&
    entity.relationshipHint === "likely_multi_tech_location"
  ) {
    return "high";
  }

  const hasReadyBase =
    nailsLed &&
    score >= 65 &&
    (hasWebsiteSignal(row) || isDenseNeighborSignal(row) || !!row.shop_license) &&
    !isRejected(reviewStatus);

  if (hasReadyBase) {
    /** Multiple validated attached operators + active zone → stronger queue position (v1). */
    const opCount = getSurfacedOperatorCount(row.live_unit_id);
    if (opCount >= 2 && ACTIVE_ZONE_IDS.has(z) && reviewStatus !== "approved") {
      return "high";
    }
    return "ready";
  }

  if ((score >= 40 && score <= 69) || conf === "candidate_review" || conf === "ambiguous") {
    return "review";
  }

  return "low";
}

/**
 * Next action (v1, inferred from available fields — no phone column on row):
 * - promote: strong score + strong + approved path / very high score
 * - call: storefront + shop license anchor
 * - dm: website/social signal strong, suite-ish
 * - review: mid / ambiguous
 * - research: plausible but weak evidence
 * - skip: low priority nail or rejected-adjacent
 */
export function deriveNextAction(row: WorkModeRow, reviewStatus: ReviewStatusLite, priority: WorkPriority): WorkNextAction {
  const score = adjustedScoreForWorkMode(row);
  const nailsLed = rowHasNailsLedSignal(row);
  const conf = getEffectiveConfidence(row);
  const entity = deriveEntityDisplayStateForRow(toEntityDisplayInput(row));

  if (isRejected(reviewStatus)) return "skip";

  if (nailsLed && score >= 85 && conf === "strong" && hasWebsiteSignal(row)) {
    return "promote";
  }

  if (
    nailsLed &&
    entity.likelyLive &&
    entity.entityKind === "tech" &&
    hasWebsiteSignal(row) &&
    entity.entryOptions.includes("direct_tech")
  ) {
    return "dm";
  }

  if (nailsLed && (row.subtype || "").toLowerCase() === "storefront" && !!row.shop_license) {
    return "call";
  }

  if (nailsLed && hasWebsiteSignal(row) && ((row.subtype || "") === "suite" || (row.tech_count_nearby ?? 0) > 0)) {
    return "dm";
  }

  if (
    nailsLed &&
    entity.entryOptions.includes("research_relationship") &&
    (conf === "ambiguous" || conf === "candidate_review")
  ) {
    return "research";
  }

  if (priority === "review" || (score >= 40 && score <= 69)) {
    return "review";
  }

  if (nailsLed && score >= 55 && score < 70 && (conf === "likely" || conf === "candidate_review")) {
    return "research";
  }

  if (priority === "low" || score < 40) {
    return "skip";
  }

  if (priority === "ready" || priority === "high") {
    return hasWebsiteSignal(row) ? "dm" : "review";
  }

  return "review";
}

export function deriveWorkStateForRow(
  row: WorkModeRow,
  reviewStatus: ReviewStatusLite,
  activePreset: WorkPresetId | null
): WorkDerivedState {
  const priority = derivePriority(row, reviewStatus);
  let nextAction = deriveNextAction(row, reviewStatus, priority);
  nextAction = refineNextActionForPlatformSignals(row, nextAction);
  const matchesActivePreset = activePreset
    ? rowMatchesPresetStrict(row, activePreset, reviewStatus)
    : false;

  let presetReason: string | null = null;
  if (activePreset) {
    const meta = WORK_PRESETS.find((p) => p.id === activePreset);
    presetReason = meta ? meta.shortHint : null;
  }

  return {
    priority,
    nextAction,
    matchesActivePreset,
    presetReason,
  };
}

export function getWorkPresetMeta(id: WorkPresetId): WorkPresetMeta | undefined {
  return WORK_PRESETS.find((p) => p.id === id);
}

export function zoneEmphasisForPreset(presetId: WorkPresetId): string | null {
  if (presetId === "QUEBEC_HIGH_VALUE") return "Quebec";
  if (presetId === "DOWNTOWN_DENSE") return "Downtown";
  return null;
}
