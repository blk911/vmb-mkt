/**
 * Work Mode zero-state / constrained-state routing — explains empty results and suggests recovery.
 */
import type { WorkPresetId } from "./work-mode-types";
import { applyWorkPreset, getWorkPresetMeta, type ReviewStatusLite, type WorkModeRow } from "./work-mode-logic";

export type WorkResolutionAction =
  | "use_preset_only"
  | "clear_filters"
  | "switch_preset"
  | "open_review";

export type WorkResolutionSuggestedAction = {
  id: string;
  label: string;
  action: WorkResolutionAction;
  targetPresetId?: WorkPresetId;
};

/** Snapshot of Review Mode filters (only meaningful fields for copy). */
export type LiveUnitsFilterSnapshot = {
  confidence: string;
  signalMix: string;
  category: string;
  zone: string;
  city: string;
  zipQuery: string;
  scoreBand: string;
  reviewFilter: string;
  subtypeFilter: string;
  tuningFilter: string;
};

export type WorkResolutionState = {
  rowCount: number;
  isEmpty: boolean;
  isConstrainedByFilters: boolean;
  blockingConstraints: string[];
  explanation: string;
  recommendedPresetId: WorkPresetId | null;
  recommendedPresetLabel: string | null;
  suggestedActions: WorkResolutionSuggestedAction[];
  /** Results header: e.g. "0 active rows for Quebec Corridor — High Value" */
  resultsHeaderLine: string;
  /** Subtext under header: "Using saved filters" | "Using preset only" */
  scopeSubtext: string;
  /** When true, show WorkModeResolutionStrip (empty or filter-constrained). */
  showResolutionStrip: boolean;
  /** "Blocked by: …" only when saved filters removed rows for this preset. */
  blockedByLine: string | null;
  /** When preset-only and filters exist, remind they are not applied to the row set. */
  savedFiltersNote: string | null;
};

/** First non-empty preset wins (spec order). */
const RECOMMENDED_PRESET_PRIORITY: WorkPresetId[] = [
  "NEEDS_REVIEW",
  "NEW_LEADS",
  "DOWNTOWN_DENSE",
  "BOOKING_READY",
  "QUEBEC_HIGH_VALUE",
];

function formatLabel(v: string): string {
  return v.replaceAll("_", " ");
}

/** Map score band filter to operator-friendly copy, e.g. "Score 0–54". */
function scoreBandLabel(band: string): string {
  if (band === "all") return band;
  const parts = band.split("-");
  if (parts.length === 2) return `Score ${parts[0]}–${parts[1]}`;
  return `Score ${band}`;
}

/** Human-readable labels for active (non-default) filters. */
export function describeBlockingConstraints(s: LiveUnitsFilterSnapshot): string[] {
  const out: string[] = [];
  if (s.confidence !== "all") out.push(`Confidence: ${formatLabel(s.confidence)}`);
  if (s.signalMix !== "all") out.push(`Signal mix: ${s.signalMix}`);
  if (s.category !== "all") out.push(`Category: ${s.category}`);
  if (s.zone !== "all") out.push(`Zone: ${s.zone}`);
  if (s.city !== "all") out.push(`City: ${s.city}`);
  const zq = s.zipQuery.trim();
  if (zq) out.push(`ZIP ${zq}`);
  if (s.scoreBand !== "all") out.push(scoreBandLabel(s.scoreBand));
  if (s.reviewFilter !== "all") out.push(`Review: ${formatLabel(s.reviewFilter)}`);
  if (s.subtypeFilter !== "all") out.push(`Subtype: ${formatLabel(s.subtypeFilter)}`);
  if (s.tuningFilter !== "all") out.push(`Tuning: ${formatLabel(s.tuningFilter)}`);
  return out;
}

function countPreset<T extends WorkModeRow>(
  rows: T[],
  presetId: WorkPresetId,
  getReviewStatus: (id: string) => ReviewStatusLite
): number {
  return applyWorkPreset(rows, presetId, getReviewStatus).length;
}

/**
 * Pick fallback preset: first in priority order with &gt; 0 rows on full dataset.
 */
export function pickRecommendedFallbackPreset<T extends WorkModeRow>(
  currentId: WorkPresetId,
  allRows: T[],
  getReviewStatus: (id: string) => ReviewStatusLite
): { presetId: WorkPresetId | null; label: string | null } {
  for (const id of RECOMMENDED_PRESET_PRIORITY) {
    if (id === currentId) continue;
    const n = countPreset(allRows, id, getReviewStatus);
    if (n > 0) {
      const meta = getWorkPresetMeta(id);
      return { presetId: id, label: meta?.label ?? id };
    }
  }
  return { presetId: null, label: null };
}

/**
 * @param presetRows — rows matching the active preset on the full dataset (`allRows` + preset).
 * @param presetOnReviewFiltered — same preset applied after Review Mode filters.
 */
export function deriveWorkResolutionState<T extends WorkModeRow>(input: {
  allRows: T[];
  presetRows: T[];
  presetOnReviewFiltered: T[];
  usePresetOnly: boolean;
  filters: LiveUnitsFilterSnapshot;
  activePresetId: WorkPresetId | null;
  getReviewStatus: (id: string) => ReviewStatusLite;
}): WorkResolutionState {
  const {
    allRows,
    presetRows,
    presetOnReviewFiltered,
    usePresetOnly,
    filters,
    activePresetId,
    getReviewStatus,
  } = input;

  const blockingConstraints = describeBlockingConstraints(filters);
  const hasActiveReviewFilters = blockingConstraints.length > 0;

  if (!activePresetId) {
    return {
      rowCount: 0,
      isEmpty: true,
      isConstrainedByFilters: false,
      blockingConstraints,
      explanation: "Select a work preset.",
      recommendedPresetId: null,
      recommendedPresetLabel: null,
      suggestedActions: [],
      resultsHeaderLine: "",
      scopeSubtext: "",
      showResolutionStrip: false,
      blockedByLine: null,
      savedFiltersNote: null,
    };
  }

  const presetMeta = getWorkPresetMeta(activePresetId);
  const presetLabel = presetMeta?.label ?? activePresetId;

  const displayRows = usePresetOnly ? presetRows : presetOnReviewFiltered;
  const rowCount = displayRows.length;
  const isEmpty = rowCount === 0;

  const presetFullCount = presetRows.length;
  const presetFilteredCount = presetOnReviewFiltered.length;

  const isConstrainedByFilters =
    !usePresetOnly && presetFullCount > 0 && presetFilteredCount === 0 && hasActiveReviewFilters;

  const trueEmptyPreset = presetFullCount === 0;

  let explanation = "";
  if (!isEmpty) {
    explanation = `${rowCount} row${rowCount === 1 ? "" : "s"} ready for ${presetLabel}.`;
  } else if (isConstrainedByFilters) {
    explanation = "Saved review filters are narrowing this preset.";
  } else if (trueEmptyPreset) {
    explanation = `No ${presetLabel} targets exist right now.`;
  } else {
    explanation = `No rows to show for ${presetLabel}.`;
  }

  const { presetId: recId, label: recLabel } = pickRecommendedFallbackPreset(activePresetId, allRows, getReviewStatus);

  const suggestedActions: WorkResolutionSuggestedAction[] = [];
  const push = (a: WorkResolutionSuggestedAction) => {
    if (suggestedActions.some((x) => x.id === a.id)) return;
    suggestedActions.push(a);
  };

  if (isConstrainedByFilters) {
    push({ id: "preset-only", label: "Use preset only", action: "use_preset_only" });
    push({ id: "clear-filters", label: "Clear review filters", action: "clear_filters" });
  }

  if (hasActiveReviewFilters && isEmpty && !isConstrainedByFilters) {
    push({ id: "clear-filters", label: "Clear review filters", action: "clear_filters" });
  }

  if (isEmpty && recId && recId !== activePresetId) {
    const switchLabel =
      recId === "NEEDS_REVIEW" ? "Switch to Needs Review" : `Switch to ${recLabel ?? recId}`;
    push({
      id: `switch-${recId}`,
      label: switchLabel,
      action: "switch_preset",
      targetPresetId: recId,
    });
  }

  const showStrip = isEmpty || isConstrainedByFilters;
  if (showStrip) {
    push({ id: "open-review", label: "Open Review Mode", action: "open_review" });
  }

  const blockedByLine =
    isConstrainedByFilters && blockingConstraints.length > 0 ? blockingConstraints.join(", ") : null;

  const savedFiltersNote =
    usePresetOnly && trueEmptyPreset && hasActiveReviewFilters
      ? "Saved review filters are not applied in Preset only scope — switch to Preset + saved filters or open Review Mode to use them."
      : null;

  const scopeSubtext = usePresetOnly ? "Using preset only" : "Using saved filters";

  const resultsHeaderLine =
    rowCount === 0
      ? `0 active rows for ${presetLabel}`
      : `${rowCount} active row${rowCount === 1 ? "" : "s"} for ${presetLabel}`;

  return {
    rowCount,
    isEmpty,
    isConstrainedByFilters,
    blockingConstraints,
    explanation,
    recommendedPresetId: isEmpty ? recId : null,
    recommendedPresetLabel: isEmpty ? recLabel : null,
    suggestedActions,
    resultsHeaderLine,
    scopeSubtext,
    showResolutionStrip: showStrip,
    blockedByLine,
    savedFiltersNote,
  };
}
