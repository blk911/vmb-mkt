"use client";

import type { BuildWorkflowState } from "@/lib/markets/zone-build-reason-types";

const STATE_LABELS: Record<BuildWorkflowState, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  promoted: "Promoted",
  targeted: "Targeted",
  linked: "Linked",
  bookable: "Bookable",
  unknown: "Unknown",
};

const STATE_CLASS: Record<BuildWorkflowState, string> = {
  unreviewed: "border-neutral-200 bg-neutral-100 text-neutral-800",
  reviewed: "border-sky-200 bg-sky-50 text-sky-950",
  promoted: "border-emerald-200 bg-emerald-50 text-emerald-950",
  targeted: "border-amber-200 bg-amber-50 text-amber-950",
  linked: "border-violet-200 bg-violet-50 text-violet-950",
  bookable: "border-teal-200 bg-teal-50 text-teal-950",
  unknown: "border-neutral-200 bg-white text-neutral-600",
};

type Props = {
  state: BuildWorkflowState;
  className?: string;
};

export default function BuildStateBadge({ state, className = "" }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_CLASS[state]} ${className}`}
      title="Current workflow position in our data"
    >
      {STATE_LABELS[state]}
    </span>
  );
}
