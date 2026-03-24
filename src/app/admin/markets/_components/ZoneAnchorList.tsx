"use client";

import Link from "next/link";
import type { ZonePotentialAnchor } from "@/lib/markets/zone-build-ops-types";
import type { MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import { buildMemberDetailPath, buildSalesTargetPath } from "@/app/admin/markets/_lib/marketsUrlState";
import BuildReasonTags from "./BuildReasonTags";
import BuildStateBadge from "./BuildStateBadge";

type Props = {
  items: ZonePotentialAnchor[];
  marketsUrlState: MarketsUrlState;
};

export default function ZoneAnchorList({ items, marketsUrlState }: Props) {
  if (items.length === 0) {
    return <p className="text-[11px] text-neutral-500">No strong anchor candidates yet.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-1.5">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-900" title={item.name}>
                {item.name}
              </p>
              <BuildStateBadge state={item.derived.workflowState} />
            </div>
            <BuildReasonTags tags={item.derived.reasonTags} className="mt-1" />
            <p className="mt-1 text-[10px] text-neutral-600">
              <span className="font-semibold tabular-nums text-neutral-800">{item.techCountNearby ?? 0}</span> nearby
              license signal
              {item.hasStorefrontSignal ? (
                <span className="text-neutral-500"> · storefront/DORA instore</span>
              ) : null}
              {item.hasBooking ? <span className="text-emerald-700"> · booking</span> : null}
            </p>
            {item.derived.nextActionLabel ? (
              <p className="mt-1 text-[10px] text-neutral-500">{item.derived.nextActionLabel}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1">
            <Link
              href={buildMemberDetailPath(item.id, marketsUrlState)}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-white"
            >
              Review
            </Link>
            <Link
              href={buildSalesTargetPath(item.id, marketsUrlState)}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 hover:bg-white"
            >
              Target
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
