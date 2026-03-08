"use client";

import { getMarkets, getRegions } from "@/lib/markets";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import { useState } from "react";

export default function MarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();

  const [filters, setFilters] = useState({
    regionId: "DEN",
    zoneId: "ALL",
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Markets</h1>

      <MarketZoneFilters regions={regions} zones={zones} onChange={setFilters} />

      <pre className="bg-neutral-100 p-4 rounded text-xs">{JSON.stringify(filters, null, 2)}</pre>
    </div>
  );
}
