"use client";

import { useEffect, useMemo, useState } from "react";
import { BeautyRegion, BeautyZone } from "@/lib/markets";

type Props = {
  regions: BeautyRegion[];
  zones: BeautyZone[];
  initialRegionId?: string;
  initialZoneId?: string;
  onChange?: (value: {
    regionId: string;
    zoneId: string;
  }) => void;
};

export default function MarketZoneFilters({
  regions,
  zones,
  initialRegionId = "DEN",
  initialZoneId = "ALL",
  onChange,
}: Props) {
  const [regionId, setRegionId] = useState(initialRegionId);
  const [zoneId, setZoneId] = useState(initialZoneId);

  const filteredZones = useMemo(() => {
    return zones.filter((z) => z.region_id === regionId);
  }, [zones, regionId]);

  useEffect(() => {
    const zoneStillExists = zoneId === "ALL" || filteredZones.some((z) => z.zone_id === zoneId);

    if (!zoneStillExists) {
      setZoneId("ALL");
    }
  }, [filteredZones, zoneId]);

  useEffect(() => {
    onChange?.({ regionId, zoneId });
  }, [regionId, zoneId, onChange]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="min-w-[220px] flex-1">
        <label
          htmlFor="market-region"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Region
        </label>
        <select
          id="market-region"
          value={regionId}
          onChange={(e) => {
            setRegionId(e.target.value);
            setZoneId("ALL");
          }}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        >
          {regions.map((region) => (
            <option key={region.region_id} value={region.region_id}>
              {region.region_name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[260px] flex-1">
        <label
          htmlFor="market-zone"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Zone
        </label>
        <select
          id="market-zone"
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
        >
          <option value="ALL">All zones</option>
          {filteredZones.map((zone) => (
            <option key={zone.zone_id} value={zone.zone_id}>
              {zone.zone_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
