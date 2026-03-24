/**
 * Shared workflow display states for Markets, Build Mode, and Live Units (interpretation layer, not a persisted enum).
 */

export type WorkflowState =
  | "unreviewed"
  | "reviewed"
  | "promoted"
  | "targeted"
  | "linked"
  | "bookable"
  | "unknown";

export interface DerivedWorkflowState {
  state: WorkflowState;
  /** Short deterministic explanation for tooltips / cross-surface consistency. */
  reason: string | null;
}
