"use client";

import type { WorkPriority } from "@/lib/live-units/work-mode-types";

const LABELS: Record<WorkPriority, string> = {
  high: "High",
  ready: "Ready",
  review: "Review",
  low: "Low",
};

function tone(p: WorkPriority): string {
  switch (p) {
    case "high":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export default function WorkPriorityBadge({ priority }: { priority: WorkPriority }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone(priority)}`}
      title="Work priority"
    >
      {LABELS[priority]}
    </span>
  );
}
