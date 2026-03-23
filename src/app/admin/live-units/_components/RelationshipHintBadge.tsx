"use client";

import type { RelationshipHint } from "@/lib/live-units/entity-display-types";

const LABEL: Record<Exclude<RelationshipHint, "none">, string> = {
  likely_in_salon: "In Salon",
  likely_salon_anchor: "Anchor",
  likely_suite_operator: "Suite",
  likely_multi_tech_location: "Multi-Tech",
  standalone_unknown: "Standalone",
};

const STYLE = "border-neutral-300 bg-white text-neutral-800";

type Props = {
  hint: RelationshipHint;
};

/** Compact relationship context; hidden when `none`. */
export default function RelationshipHintBadge({ hint }: Props) {
  if (hint === "none") return null;
  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STYLE}`}
      title={hint.replaceAll("_", " ")}
    >
      {LABEL[hint]}
    </span>
  );
}
