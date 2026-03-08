"use client";

import { useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import { getMarkets, getRegions } from "@/lib/markets";

export default function AdminMarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();

  const [filters, setFilters] = useState({
    regionId: "DEN",
    zoneId: "ALL",
  });

  const visibleZones = useMemo(() => {
    return zones.filter((zone) => {
      if (zone.region_id !== filters.regionId) return false;
      if (filters.zoneId !== "ALL" && zone.zone_id !== filters.zoneId) {
        return false;
      }
      return true;
    });
  }, [zones, filters]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="mt-1 text-sm text-neutral-600">Filter VMB territory by region and zone.</p>
      </div>

      <MarketZoneFilters
        regions={regions}
        zones={zones}
        initialRegionId="DEN"
        initialZoneId="ALL"
        onChange={setFilters}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleZones.map((zone) => (
          <div key={zone.zone_id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{zone.zone_name}</h2>
                <p className="text-sm text-neutral-600">{zone.market}</p>
              </div>
              <span className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-600">
                {zone.status}
              </span>
            </div>

            <div className="mt-4 space-y-1 text-sm text-neutral-700">
              <div>
                <span className="font-medium">Region:</span> {zone.region_name}
              </div>
              <div>
                <span className="font-medium">Radius:</span> {zone.radius_miles} mi
              </div>
              <div>
                <span className="font-medium">Center:</span> {zone.center_lat}, {zone.center_lon}
              </div>
            </div>

            {zone.notes ? <p className="mt-4 text-sm text-neutral-600">{zone.notes}</p> : null}
          </div>
        ))}
      </section>
    </main>
  );
}
