"use client";

import type { ZoneRepairResult, ZoneRepairStage } from "@/lib/markets/zone-repair-types";

function stageBadgeClass(stage: ZoneRepairStage): string {
  switch (stage) {
    case "zone_assignment_missing":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "live_units_not_promoted":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "markets_members_missing":
      return "bg-neutral-100 text-neutral-800 ring-neutral-200";
    case "anchors_missing":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "expansion_heavy":
      return "bg-sky-100 text-sky-950 ring-sky-200";
    case "operational_gap":
      return "bg-violet-100 text-violet-900 ring-violet-200";
    case "healthy":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    default:
      return "bg-neutral-100 text-neutral-800 ring-neutral-200";
  }
}

function stageLabel(stage: ZoneRepairStage): string {
  return stage.replace(/_/g, " ");
}

type Props = {
  repair: ZoneRepairResult;
};

/**
 * Compact trace-driven repair hint for the selected zone (stage + summary + recommended action).
 */
export default function ZoneRepairPanel({ repair }: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Zone repair</span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ${stageBadgeClass(repair.stage)}`}
        >
          {stageLabel(repair.stage)}
        </span>
        <span className="text-[10px] text-neutral-400 tabular-nums">{repair.zoneId}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-neutral-800">{repair.summary}</p>
      <p className="mt-1 text-[11px] leading-snug text-neutral-600">
        <span className="font-medium text-neutral-700">Next: </span>
        {repair.recommendedAction}
      </p>
    </div>
  );
}
