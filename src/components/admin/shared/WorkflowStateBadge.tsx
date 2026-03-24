"use client";

import type { WorkflowState } from "@/lib/workflow/workflow-state-types";
import { getWorkflowStateLabel } from "@/lib/workflow/workflow-state-logic";

const STATE_CLASS: Record<WorkflowState, string> = {
  unreviewed: "border-neutral-200 bg-neutral-100 text-neutral-800",
  reviewed: "border-sky-200 bg-sky-50 text-sky-950",
  promoted: "border-emerald-200 bg-emerald-50 text-emerald-950",
  targeted: "border-amber-200 bg-amber-50 text-amber-950",
  linked: "border-violet-200 bg-violet-50 text-violet-950",
  bookable: "border-teal-200 bg-teal-50 text-teal-950",
  unknown: "border-neutral-200 bg-white text-neutral-600",
};

type Props = {
  state: WorkflowState;
  /** Overrides default label; normally from getWorkflowStateLabel. */
  label?: string;
  /** Tooltip — shared derivation reason when available. */
  title?: string | null;
  className?: string;
};

export default function WorkflowStateBadge({ state, label, title, className = "" }: Props) {
  const text = label ?? getWorkflowStateLabel(state);
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_CLASS[state]} ${className}`}
      title={title ?? text}
    >
      {text}
    </span>
  );
}
