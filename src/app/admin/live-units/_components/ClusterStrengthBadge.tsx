"use client";

import type { ClusterStrength } from "@/lib/live-units/cluster-mode-types";

const STYLES: Record<ClusterStrength, string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-950",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

const LABELS: Record<ClusterStrength, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type Props = {
  strength: ClusterStrength;
  className?: string;
};

export default function ClusterStrengthBadge({ strength, className = "" }: Props) {
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${STYLES[strength]} ${className}`}
      title="Cluster strength (heuristic — conservative)"
    >
      Cluster {LABELS[strength]}
    </span>
  );
}
