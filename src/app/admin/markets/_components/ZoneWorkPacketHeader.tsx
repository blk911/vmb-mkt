"use client";

import type { BeautyZone } from "@/lib/markets";
import type { MarketsWorkPreset, ZoneOpsSummary } from "@/lib/markets/zone-ops-types";
import { getZoneDisplayLabel } from "@/lib/geo/target-zones";
import ZoneOpsStats from "./ZoneOpsStats";
import ZoneWorkPresetChips from "./ZoneWorkPresetChips";

type Props = {
  zone: BeautyZone;
  summary: ZoneOpsSummary | undefined;
  workPreset: MarketsWorkPreset | null;
  onWorkPresetChange: (preset: MarketsWorkPreset | null) => void;
};

export default function ZoneWorkPacketHeader({ zone, summary, workPreset, onWorkPresetChange }: Props) {
  const label = getZoneDisplayLabel(zone.zone_id);

  return (
    <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Zone work packet</p>
          <h2 className="mt-0.5 text-lg font-semibold text-neutral-900">{label}</h2>
          <p className="mt-0.5 truncate text-xs text-neutral-600" title={zone.market}>
            {zone.market}
          </p>
        </div>
      </div>

      {summary ? (
        <div className="mt-3">
          <ZoneOpsStats summary={summary} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">No member data loaded for this zone yet.</p>
      )}

      <div className="mt-3 border-t border-sky-100 pt-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Quick views</p>
        <ZoneWorkPresetChips activePreset={workPreset} onSelect={onWorkPresetChange} />
      </div>
    </section>
  );
}
