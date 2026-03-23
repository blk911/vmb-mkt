"use client";

import type { ZoneMaturity } from "@/lib/geo/target-zones";

const LABELS: Record<ZoneMaturity, string> = {
  active: "Active",
  partial: "Partial",
  needs_survey: "Needs Survey",
};

const STYLES: Record<ZoneMaturity, string> = {
  active: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
  partial: "border-amber-200 bg-amber-50/90 text-amber-950",
  needs_survey: "border-violet-200 bg-violet-50/90 text-violet-950",
};

type Props = {
  maturity: ZoneMaturity;
  className?: string;
};

export default function ZoneMaturityBadge({ maturity, className = "" }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STYLES[maturity]} ${className}`}
    >
      {LABELS[maturity]}
    </span>
  );
}
