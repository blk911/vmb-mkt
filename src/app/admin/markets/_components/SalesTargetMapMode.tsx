"use client";

import { useMemo } from "react";
import { PresenceBadges } from "@/components/admin/PresenceBadges";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import type { MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import {
  type NearbyProspectRow,
  type RingRollup,
  SALES_TARGET_RINGS,
  type SalesRingMiles,
  sortNearbyProspectsByRank,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import { NearbyProspectSection, SalesMapCanvas } from "./salesTargetMapParts";

export type SalesTargetMapModeProps = {
  origin: EnrichedBeautyZoneMember | null;
  onClearOrigin: () => void;
  nearbyRows: NearbyProspectRow[];
  ringMiles: SalesRingMiles;
  onRingMiles: (r: SalesRingMiles) => void;
  ringRollups: { r25: RingRollup; r5: RingRollup; r1: RingRollup } | null;
  marketsUrlState: MarketsUrlState;
};

export function SalesTargetMapMode({
  origin,
  onClearOrigin,
  nearbyRows,
  ringMiles,
  onRingMiles,
  ringRollups,
  marketsUrlState,
}: SalesTargetMapModeProps) {
  const inRing = useMemo(
    () => nearbyRows.filter((r) => r.distance_miles <= ringMiles),
    [nearbyRows, ringMiles]
  );

  const anchors = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.member.is_anchor)),
    [inRing]
  );
  const activeOnly = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.active && !r.member.is_anchor)),
    [inRing]
  );
  const hiddenOpp = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.is_hidden_cluster)),
    [inRing]
  );

  return (
    <div className="border-b border-neutral-200 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Sales Target Map</h3>
          <p className="text-xs text-neutral-500">
            Ranked nearby lists (score + outreach + priority). Rings: zone coords only.
          </p>
        </div>
        {origin ? (
          <button
            type="button"
            onClick={onClearOrigin}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Clear origin
          </button>
        ) : null}
      </div>

      {!origin ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
          Select a business as origin: use <span className="font-semibold">Set origin</span> on a table row below, or{" "}
          <span className="font-semibold">Open target page</span> for the full console.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Origin</div>
              <div className="mt-0.5 font-semibold text-neutral-900">{origin.name}</div>
              <div className="mt-1 text-xs text-neutral-600">{[origin.address, origin.city, origin.state, origin.zip].filter(Boolean).join(", ")}</div>
              <div className="mt-1 text-xs text-neutral-600">
                {origin.category} · {origin.subtype}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PresenceBadges member={origin} />
                <PathEnrichmentBadge member={origin} />
              </div>
              {ringRollups ? (
                <div className="mt-1.5 text-[9px] leading-snug text-neutral-600 opacity-90">
                  Rings: ≤0.25 A{ringRollups.r25.anchors}/Act{ringRollups.r25.active}/C{ringRollups.r25.distinct_clusters} · ≤0.5
                  A{ringRollups.r5.anchors}/Act{ringRollups.r5.active}/C{ringRollups.r5.distinct_clusters} · ≤1 A
                  {ringRollups.r1.anchors}/Act{ringRollups.r1.active}/C{ringRollups.r1.distinct_clusters}
                </div>
              ) : null}
            </div>

            <SalesMapCanvas origin={origin} nearbyRows={nearbyRows} />

            <div className="flex flex-wrap gap-2">
              <span className="self-center text-[11px] font-semibold text-neutral-500">List radius:</span>
              {SALES_TARGET_RINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRingMiles(r)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    ringMiles === r ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800"
                  }`}
                >
                  {r} mi
                </button>
              ))}
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 lg:w-[22rem]">
            <div className="text-xs font-semibold text-neutral-800">
              Nearby (≤{ringMiles} mi) · {inRing.length} prospects
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-neutral-500">
              <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> 0.25 mi
              <span className="mx-1 inline-block h-2 w-2 rounded-full bg-yellow-600" /> 0.5 mi
              <span className="mx-1 inline-block h-2 w-2 rounded-full bg-red-600" /> 1.0 mi
            </div>
            <div className="mt-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
              <NearbyProspectSection title="Anchors nearby" rows={anchors} marketsUrlState={marketsUrlState} />
              <NearbyProspectSection title="Active nearby" rows={activeOnly} marketsUrlState={marketsUrlState} />
              <NearbyProspectSection title="Hidden-opportunity nearby" rows={hiddenOpp} marketsUrlState={marketsUrlState} />
              {!anchors.length && !activeOnly.length && !hiddenOpp.length ? (
                <p className="text-xs text-neutral-500">No prospects in this ring with these groupings.</p>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
