"use client";

import Link from "next/link";
import type { ZoneUnresolvedCandidate } from "@/lib/markets/zone-build-ops-types";
import type { MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import { buildMemberDetailPath, buildSalesTargetPath } from "@/app/admin/markets/_lib/marketsUrlState";
import BuildReasonTags from "./BuildReasonTags";
import BuildStateBadge from "./BuildStateBadge";

type Props = {
  items: ZoneUnresolvedCandidate[];
  marketsUrlState: MarketsUrlState;
};

export default function ZoneUnresolvedList({ items, marketsUrlState }: Props) {
  if (items.length === 0) {
    return <p className="text-[11px] text-neutral-500">No unresolved candidates in this zone.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start gap-2 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-1.5">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-900" title={item.name}>
                {item.name}
              </p>
              <BuildStateBadge state={item.derived.workflowState} />
            </div>
            <BuildReasonTags tags={item.derived.reasonTags} className="mt-1" />
            {item.entityKind ? (
              <p className="mt-0.5 text-[10px] text-neutral-500">{item.entityKind}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-1">
              {item.serviceSignals?.slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="inline-block max-w-[8rem] truncate rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-700"
                  title={s}
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
              <span title="Instagram">{item.hasInstagram ? "IG" : "— IG"}</span>
              <span className="text-neutral-300">·</span>
              <span title="Booking">{item.hasBooking ? "Book" : "— Book"}</span>
            </div>
            {item.derived.nextActionLabel ? (
              <p className="mt-1 text-[10px] text-neutral-500">{item.derived.nextActionLabel}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Link
              href={buildMemberDetailPath(item.id, marketsUrlState)}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-center text-[10px] font-semibold text-sky-800 hover:bg-white"
            >
              Review
            </Link>
            <Link
              href={buildSalesTargetPath(item.id, marketsUrlState)}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-center text-[10px] font-semibold text-neutral-800 hover:bg-white"
              title="Sales target console — closest in-app promote path"
            >
              Promote
            </Link>
            <button
              type="button"
              className="cursor-default rounded border border-dashed border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-400"
              title="Placeholder — no server action wired"
            >
              Skip
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
