/**
 * Reason tags vs workflow state for Build Mode list rows (display + scanning).
 */

export type BuildReasonTag =
  | "needs_review"
  | "resolution_unmatched"
  | "path_unmatched"
  | "weak_identity"
  | "low_signal"
  | "storefront"
  | "booking"
  | "nearby_licenses"
  | "anchor_like"
  | "platform_match"
  | "matched_live_unit"
  | "bookable";

export type BuildWorkflowState =
  | "unreviewed"
  | "reviewed"
  | "promoted"
  | "targeted"
  | "linked"
  | "bookable"
  | "unknown";

export interface DerivedBuildItemState {
  reasonTags: BuildReasonTag[];
  workflowState: BuildWorkflowState;
  /** Short hint for next step; null when obvious from actions alone. */
  nextActionLabel: string | null;
}
