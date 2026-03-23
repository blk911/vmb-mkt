"use client";

import type { WorkNextAction } from "@/lib/live-units/work-mode-types";

const LABELS: Record<WorkNextAction, string> = {
  call: "Call",
  dm: "DM",
  review: "Review",
  research: "Research",
  skip: "Skip",
  promote: "Promote",
};

function tone(a: WorkNextAction): string {
  switch (a) {
    case "promote":
      return "border-sky-300 bg-sky-50 text-sky-900";
    case "call":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "dm":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
    case "review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "research":
      return "border-orange-200 bg-orange-50 text-orange-900";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export default function WorkNextActionBadge({ action }: { action: WorkNextAction }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone(action)}`}
      title="Suggested next action"
    >
      {LABELS[action]}
    </span>
  );
}
