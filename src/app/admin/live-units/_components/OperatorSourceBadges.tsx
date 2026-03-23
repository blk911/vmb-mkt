"use client";

import type { OperatorSourceType } from "@/lib/live-units/operator-extraction-types";

const LABEL: Record<OperatorSourceType, string> = {
  website_staff_page: "Website",
  website_provider_page: "Website",
  instagram_business_bio: "IG Bio",
  instagram_business_post: "IG Post",
  instagram_cross_link: "Cross-linked",
  other: "Other",
};

type Props = {
  sourceTypes: OperatorSourceType[];
};

export default function OperatorSourceBadges({ sourceTypes }: Props) {
  const unique = [...new Set(sourceTypes)];
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {unique.map((s) => (
        <span
          key={s}
          className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
        >
          {LABEL[s]}
        </span>
      ))}
    </div>
  );
}
