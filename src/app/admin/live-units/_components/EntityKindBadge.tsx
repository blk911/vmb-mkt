"use client";

import type { LiveLabel } from "@/lib/live-units/entity-display-types";

const STYLES: Record<LiveLabel, string> = {
  "Live Salon": "border-emerald-300 bg-emerald-50 text-emerald-950",
  "Live Tech": "border-sky-300 bg-sky-50 text-sky-950",
  "Live Mixed": "border-violet-300 bg-violet-50 text-violet-950",
  Unclear: "border-slate-300 bg-slate-100 text-slate-700",
};

type Props = {
  label: LiveLabel;
  className?: string;
};

export default function EntityKindBadge({ label, className = "" }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STYLES[label]} ${className}`}
    >
      {label}
    </span>
  );
}
