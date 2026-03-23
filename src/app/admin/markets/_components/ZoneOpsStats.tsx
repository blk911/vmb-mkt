"use client";

import type { ZoneOpsSummary } from "@/lib/markets/zone-ops-types";

type Props = {
  summary: ZoneOpsSummary;
  compact?: boolean;
};

/**
 * Compact ops metrics for zone cards / headers.
 */
export default function ZoneOpsStats({ summary, compact }: Props) {
  const rows = compact
    ? [
        { k: "Anchors", v: summary.anchorCount },
        { k: "Clusters", v: summary.clusterCount },
        { k: "Bookable", v: summary.bookableCount },
        { k: "Hi pri", v: summary.highPriorityCount },
      ]
    : [
        { k: "Members", v: summary.totalMembers },
        { k: "Anchors", v: summary.anchorCount },
        { k: "Clusters", v: summary.clusterCount },
        { k: "Bookable", v: summary.bookableCount },
        { k: "High priority", v: summary.highPriorityCount },
        { k: "Needs review", v: summary.unresolvedCount },
        { k: "Active presence", v: summary.outreachReadyCount },
      ];

  return (
    <div className={`grid gap-1 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
      {rows.map(({ k, v }) => (
        <div key={k} className="flex items-baseline justify-between gap-1 rounded border border-neutral-100 bg-neutral-50/80 px-1.5 py-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">{k}</span>
          <span className="tabular-nums text-[11px] font-semibold text-neutral-900">{v}</span>
        </div>
      ))}
    </div>
  );
}
