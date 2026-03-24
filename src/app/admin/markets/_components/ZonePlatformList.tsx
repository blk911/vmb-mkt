"use client";

import type { ZonePlatformSignalItem } from "@/lib/markets/zone-build-ops-types";
import WorkflowStateBadge from "@/components/admin/shared/WorkflowStateBadge";
import BuildReasonTags from "./BuildReasonTags";

type Props = {
  items: ZonePlatformSignalItem[];
};

export default function ZonePlatformList({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-[11px] text-neutral-500">No booking platforms detected.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((item) => (
        <li
          key={`${item.id}-${item.platform}`}
          className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-1.5">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-900" title={item.name}>
                {item.name}
              </p>
              <WorkflowStateBadge state={item.derived.workflowState} title={item.derived.workflowReason ?? undefined} />
            </div>
            <BuildReasonTags tags={item.derived.reasonTags} className="mt-1" />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-900">
                {item.platform}
              </span>
              <span className="text-[9px] text-neutral-500">
                {item.source === "live_unit" ? "Approved live unit" : "Stitched member"}
              </span>
            </div>
            {item.derived.nextActionLabel ? (
              <p className="mt-1 text-[10px] text-neutral-500">{item.derived.nextActionLabel}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
