"use client";

import type { EnrichmentFeedbackResult } from "@/lib/live-units/enrichment-feedback-types";

const REASON_SHORT: Record<string, string> = {
  ig_found: "+IG",
  booking_found: "+Booking",
  location_confirmed: "+Location",
  identity_strengthened: "+Identity",
  operator_linked: "+Operator",
  platform_confirmed: "+Platform",
};

type Props = {
  result: EnrichmentFeedbackResult;
};

/** Compact feedback chips for Expansion rows — existing signals only, client-derived. */
export default function EnrichmentUpgradeBadge({ result }: Props) {
  if (!result.upgraded && result.reasons.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 pl-5 pr-1">
      {result.movedToHighConfidence ? (
        <span
          className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 ring-1 ring-emerald-200/80"
          title="Feedback-adjusted score reaches ≥70 — appears in High Confidence layer"
        >
          Would reach ≥70
        </span>
      ) : result.upgraded ? (
        <span
          className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900 ring-1 ring-sky-200/80"
          title="In-house signals support a score nudge"
        >
          Upgradable (+{result.boost})
        </span>
      ) : null}
      {result.reasons.map((r) => (
        <span
          key={r}
          className="rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-800 ring-1 ring-violet-200/70"
          title={r.replaceAll("_", " ")}
        >
          {REASON_SHORT[r] ?? r}
        </span>
      ))}
    </div>
  );
}
