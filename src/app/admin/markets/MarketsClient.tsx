"use client";

import { useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import type { BeautyRegion, BeautyZone } from "@/lib/markets";

type Props = {
  regions: BeautyRegion[];
  zones: BeautyZone[];
};

export default function MarketsClient({ regions, zones }: Props) {
  const [filters, setFilters] = useState({
    regionId: "DEN",
    zoneId: "ALL",
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Markets</h1>

      <MarketZoneFilters
        regions={regions}
        zones={zones}
        onChange={setFilters}
      />

      <pre className="rounded bg-neutral-100 p-4 text-xs">
        {JSON.stringify(filters, null, 2)}
      </pre>
    </div>
  );
}
