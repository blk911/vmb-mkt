"use client";

import type { EntryOption } from "@/lib/live-units/entity-display-types";

const SHORT: Record<EntryOption, string> = {
  salon_owner_front_desk: "Front Desk",
  direct_tech: "Direct Tech",
  service_led_entry: "Service Entry",
  mixed_service_entry: "Mixed Entry",
  research_relationship: "Research",
};

const TONE = "border-neutral-200 bg-neutral-50 text-neutral-800";

type Props = {
  options: EntryOption[];
  className?: string;
};

/** Possible entry angles — hints only, not prescribed plays. */
export default function EntryOptionChips({ options, className = "" }: Props) {
  if (options.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {options.map((o) => (
        <span
          key={o}
          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${TONE}`}
          title={o.replaceAll("_", " ")}
        >
          {SHORT[o]}
        </span>
      ))}
    </div>
  );
}
