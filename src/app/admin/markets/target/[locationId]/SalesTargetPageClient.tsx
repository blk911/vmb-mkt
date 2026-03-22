"use client";

import Link from "next/link";
import type { NearbyProspectRow, RingRollup, SalesRingMiles } from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import { buildMarketsListPath, type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import { SalesTargetOperatorView } from "@/app/admin/markets/_components/SalesTargetOperatorView";

export function SalesTargetPageClient({
  origin,
  nearbyRows,
  ringRollups,
  marketsUrlState,
  initialRing,
  hasValidCoords,
}: {
  origin: EnrichedBeautyZoneMember;
  nearbyRows: NearbyProspectRow[];
  ringRollups: { r25: RingRollup; r5: RingRollup; r1: RingRollup };
  marketsUrlState: MarketsUrlState;
  initialRing: SalesRingMiles;
  hasValidCoords: boolean;
}) {
  const back = buildMarketsListPath(marketsUrlState);

  if (!hasValidCoords) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-xl font-semibold text-neutral-900">Sales target</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">No valid coordinates</p>
          <p className="mt-1 text-xs text-amber-900/90">
            {origin.name} ({origin.location_id}) has no usable lat/lon in the dataset — map and distance lists cannot be
            computed.
          </p>
        </div>
        <Link href={back} className="inline-flex rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  return (
    <SalesTargetOperatorView
      origin={origin}
      nearbyRows={nearbyRows}
      ringRollups={ringRollups}
      marketsUrlState={marketsUrlState}
      initialRing={initialRing}
    />
  );
}
