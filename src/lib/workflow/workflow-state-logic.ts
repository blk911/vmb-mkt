/**
 * Single derivation path for workflow display state — Markets members + Live Units rows.
 * Uses existing JSON/API fields only; no new persistence.
 */
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import type { PlatformSignalsRecord } from "@/lib/live-units/platform-signal-types";
import type { DerivedWorkflowState, WorkflowState } from "./workflow-state-types";

const PRIORITY_ORDER: WorkflowState[] = [
  "targeted",
  "promoted",
  "reviewed",
  "linked",
  "bookable",
  "unreviewed",
  "unknown",
];

export function compareWorkflowStatePriority(a: WorkflowState, b: WorkflowState): number {
  return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
}

const LABELS: Record<WorkflowState, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  promoted: "Promoted",
  targeted: "Targeted",
  linked: "Linked",
  bookable: "Bookable",
  unknown: "Unknown",
};

export function getWorkflowStateLabel(state: WorkflowState): string {
  return LABELS[state];
}

function hasIg(m: Pick<EnrichedBeautyZoneMember, "instagram_url" | "instagram_handle">): boolean {
  return !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
}

function hasBooking(m: Pick<EnrichedBeautyZoneMember, "booking_url" | "booking_provider">): boolean {
  return !!(m.booking_url?.trim() || m.booking_provider?.trim());
}

/**
 * Markets stitched member row — priority: promoted > reviewed > linked > bookable > unreviewed.
 * Targeted is reserved for future target-list linkage; not inferred from current member JSON.
 */
export function deriveWorkflowStateFromMarketMember(m: EnrichedBeautyZoneMember): DerivedWorkflowState {
  if (m.is_anchor) {
    return { state: "promoted", reason: "Anchor flag on stitched member" };
  }
  const grayOk = m.gray_resolution_matched === true;
  const pathOk = m.path_enrichment_matched === true;
  if (grayOk || pathOk) {
    return {
      state: "reviewed",
      reason: grayOk ? "Gray resolution matched" : "Path enrichment matched",
    };
  }
  if (m.anchor_directory_matched === true) {
    return { state: "linked", reason: "Anchor directory match" };
  }
  if (hasBooking(m) && hasIg(m)) {
    return { state: "bookable", reason: "Instagram + booking on listing" };
  }
  return { state: "unreviewed", reason: null };
}

export type PlatformBuildContext = {
  source: "member" | "live_unit";
  isBookable: boolean;
};

/** Build Mode platform queue rows (member booking vs approved live unit platformSignals). */
export function deriveWorkflowStateFromPlatformBuildContext(ctx: PlatformBuildContext): DerivedWorkflowState {
  if (ctx.source === "live_unit") {
    return { state: "linked", reason: "Approved live unit + platform signal" };
  }
  if (ctx.isBookable) {
    return { state: "bookable", reason: "Bookable path on stitched member" };
  }
  return { state: "unreviewed", reason: "Booking provider without confirmed bookable path" };
}

export type LiveUnitWorkflowInput = {
  entity_score: number;
  tuned_entity_score?: number;
  confidence: string;
  tuned_confidence?: string;
  shop_license?: string | null;
  explanation?: string;
  raw_snippets?: {
    google?: { id?: string };
    dora?: { license_row_ids?: string[] };
  };
  platformSignals?: PlatformSignalsRecord | null;
};

export type LiveUnitReviewStatus =
  | "approved"
  | "rejected"
  | "watch"
  | "needs_research"
  | "unreviewed"
  | undefined;

function effectiveConfidence(row: LiveUnitWorkflowInput): string {
  return (row.tuned_confidence || row.confidence || "").toLowerCase();
}

function effectiveScore(row: LiveUnitWorkflowInput): number {
  return typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score;
}

function hasEvidenceLinks(row: LiveUnitWorkflowInput): boolean {
  if (row.shop_license?.trim()) return true;
  if (row.raw_snippets?.google?.id) return true;
  const ids = row.raw_snippets?.dora?.license_row_ids;
  if (ids && ids.length > 0) return true;
  return false;
}

function hasAnyPlatformSignal(row: LiveUnitWorkflowInput): boolean {
  const ps = row.platformSignals;
  if (!ps) return false;
  return Object.keys(ps).length > 0;
}

function hasBookablePlatform(row: LiveUnitWorkflowInput): boolean {
  const ps = row.platformSignals;
  if (!ps) return false;
  for (const p of ["fresha", "vagaro", "booksy", "glossgenius"] as const) {
    if (ps[p]?.isBookable) return true;
  }
  return false;
}

/**
 * Live Units row + optional review decision from review-state API.
 * Priority: promoted (approved) > reviewed (touched) > linked (evidence) > bookable (platform) > unreviewed.
 */
export function deriveWorkflowStateFromLiveUnit(
  row: LiveUnitWorkflowInput,
  reviewStatus: LiveUnitReviewStatus
): DerivedWorkflowState {
  const status = reviewStatus || "unreviewed";

  if (status === "approved") {
    return { state: "promoted", reason: "Review approved — operational unit" };
  }

  if (status === "rejected" || status === "watch" || status === "needs_research") {
    const label =
      status === "rejected" ? "Rejected in review" : status === "watch" ? "Watch" : "Needs research";
    return { state: "reviewed", reason: `${label} — operator reviewed` };
  }

  if (hasBookablePlatform(row)) {
    return { state: "bookable", reason: "Bookable platform signal attached" };
  }
  if (hasEvidenceLinks(row) || hasAnyPlatformSignal(row)) {
    return { state: "linked", reason: "Linked to shop, DORA, Google, or platform metadata" };
  }

  const conf = effectiveConfidence(row);
  const score = effectiveScore(row);
  if (conf === "ambiguous" && score < 40) {
    return { state: "unknown", reason: "Low score / ambiguous confidence" };
  }

  return { state: "unreviewed", reason: null };
}
