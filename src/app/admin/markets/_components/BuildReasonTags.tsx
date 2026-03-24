"use client";

import type { BuildReasonTag } from "@/lib/markets/zone-build-reason-types";

const REASON_LABELS: Record<BuildReasonTag, string> = {
  needs_review: "Needs review",
  resolution_unmatched: "Resolution unmatched",
  path_unmatched: "Path unmatched",
  weak_identity: "Weak identity",
  low_signal: "Low signal",
  storefront: "Storefront",
  booking: "Booking",
  nearby_licenses: "Nearby licenses",
  anchor_like: "Anchor-like",
  platform_match: "Platform match",
  matched_live_unit: "Live unit",
  bookable: "Bookable",
};

type Props = {
  tags: BuildReasonTag[];
  className?: string;
};

export default function BuildReasonTags({ tags, className = "" }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`} aria-label="Why this row appears">
      {tags.map((t) => (
        <span
          key={t}
          className="max-w-[11rem] truncate rounded border border-neutral-200 bg-neutral-50/90 px-1.5 py-0.5 text-[9px] font-medium text-neutral-700"
          title={REASON_LABELS[t]}
        >
          {REASON_LABELS[t]}
        </span>
      ))}
    </div>
  );
}
