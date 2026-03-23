/**
 * Deterministic Work Mode rules over Live Units rows.
 * Maps to fields present on live unit rows (operational_category, zone_id, scores, signal_mix, etc.).
 *
 * Priority / next-action are operator hints only — not persisted.
 */
import {
  WORK_PRESETS,
  type WorkDerivedState,
  type WorkNextAction,
  type WorkPresetId,
  type WorkPriority,
  type WorkPresetMeta,
} from "./work-mode-types";

export type ReviewStatusLite = "approved" | "rejected" | "watch" | "needs_research" | undefined;

/** Minimal row shape for work logic (compatible with LiveUnitsClient row). */
export type WorkModeRow = {
  live_unit_id: string;
  operational_category: string;
  subtype?: string;
  entity_score: number;
  tuned_entity_score?: number;
  signal_mix: string;
  confidence: string;
  tuned_confidence?: string;
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string; website_domain?: string };
  };
  shop_license?: string | null;
  tech_count_nearby?: number;
};

export function getEffectiveScore(row: WorkModeRow): number {
  return typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score;
}

export function getZoneId(row: WorkModeRow): string {
  return row.raw_snippets?.google?.zone_id || "NO_ZONE";
}

export function getZoneName(row: WorkModeRow): string {
  return row.raw_snippets?.google?.zone_name || "No zone";
}

/** Nails-related operational category (v1 heuristic). */
export function isNailsRelatedCategory(operationalCategory: string): boolean {
  const c = operationalCategory.toLowerCase();
  if (c.includes("nail") || c.includes("manicure") || c.includes("pedicure")) return true;
  if (c.includes("gel") && c.includes("nail")) return true;
  return false;
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

/** Whether row passes the preset filter (deterministic). */
export function rowMatchesPreset(row: WorkModeRow, presetId: WorkPresetId, reviewStatus: ReviewStatusLite): boolean {
  const score = getEffectiveScore(row);
  const z = getZoneId(row);
  const nails = isNailsRelatedCategory(row.operational_category);
  const conf = getEffectiveConfidence(row);

  switch (presetId) {
    case "QUEBEC_HIGH_VALUE":
      if (!nails) return false;
      if (z !== "QUEBEC_CORRIDOR") return false;
      if (score < 70) return false;
      if (isRejected(reviewStatus)) return false;
      return true;

    case "DOWNTOWN_DENSE":
      if (!nails) return false;
      if (z !== "DOWNTOWN_CORE") return false;
      if (score < 60) return false;
      if (isRejected(reviewStatus)) return false;
      return isDenseNeighborSignal(row);

    case "BOOKING_READY":
      if (!nails) return false;
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

export function applyWorkPreset<T extends WorkModeRow>(
  rows: T[],
  presetId: WorkPresetId,
  getReviewStatus: (liveUnitId: string) => ReviewStatusLite
): T[] {
  return rows.filter((row) => rowMatchesPreset(row, presetId, getReviewStatus(row.live_unit_id)));
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

const ACTIVE_ZONE_IDS = new Set(["QUEBEC_CORRIDOR", "DOWNTOWN_CORE", "CHERRY_CREEK"]);

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
    if (ACTIVE_ZONE_IDS.has(getZoneId(row))) inActiveZone += 1;
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
  const score = getEffectiveScore(row);
  const nails = isNailsRelatedCategory(row.operational_category);
  const z = getZoneId(row);
  const conf = getEffectiveConfidence(row);

  if (isRejected(reviewStatus)) return "low";

  if (
    nails &&
    score >= 70 &&
    ACTIVE_ZONE_IDS.has(z) &&
    reviewStatus !== "approved"
  ) {
    return "high";
  }

  if (
    nails &&
    score >= 65 &&
    (hasWebsiteSignal(row) || isDenseNeighborSignal(row) || !!row.shop_license) &&
    !isRejected(reviewStatus)
  ) {
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
  const score = getEffectiveScore(row);
  const nails = isNailsRelatedCategory(row.operational_category);
  const conf = getEffectiveConfidence(row);

  if (isRejected(reviewStatus)) return "skip";

  if (nails && score >= 85 && conf === "strong" && hasWebsiteSignal(row)) {
    return "promote";
  }

  if (nails && (row.subtype || "").toLowerCase() === "storefront" && !!row.shop_license) {
    return "call";
  }

  if (nails && hasWebsiteSignal(row) && ((row.subtype || "") === "suite" || (row.tech_count_nearby ?? 0) > 0)) {
    return "dm";
  }

  if (priority === "review" || (score >= 40 && score <= 69)) {
    return "review";
  }

  if (nails && score >= 55 && score < 70 && (conf === "likely" || conf === "candidate_review")) {
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
  const nextAction = deriveNextAction(row, reviewStatus, priority);
  const matchesActivePreset = activePreset
    ? rowMatchesPreset(row, activePreset, reviewStatus)
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
  if (presetId === "QUEBEC_HIGH_VALUE") return "Quebec Corridor";
  if (presetId === "DOWNTOWN_DENSE") return "Downtown Core";
  return null;
}
