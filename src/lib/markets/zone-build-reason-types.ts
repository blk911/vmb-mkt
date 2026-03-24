/**
 * Reason tags vs workflow state for Build Mode list rows (display + scanning).
 */
import type { WorkflowState } from "@/lib/workflow/workflow-state-types";

/** @deprecated use WorkflowState from @/lib/workflow/workflow-state-types — kept for call-site clarity */
export type BuildWorkflowState = WorkflowState;

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

export interface DerivedBuildItemState {
  reasonTags: BuildReasonTag[];
  workflowState: WorkflowState;
  /** Shared derivation rationale (tooltip / consistency with Live Units). */
  workflowReason?: string | null;
  /** Short hint for next step; null when obvious from actions alone. */
  nextActionLabel: string | null;
}
