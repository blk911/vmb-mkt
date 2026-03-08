"use client";

import { useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import type { BeautyRegion, BeautyZone, BeautyZoneMember } from "@/lib/markets";

type Props = {
  regions: BeautyRegion[];
  zones: BeautyZone[];
  members: BeautyZoneMember[];
};

export default function MarketsClient({ regions, zones, members }: Props) {
  const [filters, setFilters] = useState({
    regionId: "DEN",
    zoneId: "ALL",
  });

  const visibleZones = useMemo(() => {
    return zones.filter((zone) => {
      if (zone.region_id !== filters.regionId) return false;
      if (filters.zoneId !== "ALL" && zone.zone_id !== filters.zoneId) return false;
      return true;
    });
  }, [filters, zones]);

  const zoneCounts = useMemo(() => {
    return members.reduce<Record<string, number>>((acc, member) => {
      acc[member.zone_id] = (acc[member.zone_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [members]);

  const zoneCategoryRollups = useMemo(() => {
    return members.reduce<Record<string, Record<string, number>>>((acc, member) => {
      const zoneRollup = (acc[member.zone_id] ??= {});
      zoneRollup[member.category] = (zoneRollup[member.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [members]);

  const visibleMembers = useMemo(() => {
    if (filters.zoneId === "ALL") return [];

    return members
      .filter((member) => member.zone_id === filters.zoneId)
      .sort((a, b) => {
        if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
        return a.name.localeCompare(b.name);
      });
  }, [filters.zoneId, members]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Markets</h1>

      <MarketZoneFilters
        regions={regions}
        zones={zones}
        initialRegionId="DEN"
        initialZoneId="ALL"
        onChange={setFilters}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleZones.map((zone) => (
          <article
            key={zone.zone_id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">{zone.zone_name}</h2>
                <p className="text-sm text-neutral-600">{zone.market}</p>
              </div>
              <span className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-600">
                {zone.status}
              </span>
            </div>

            <div className="mt-4 space-y-1 text-sm text-neutral-700">
              <div>
                <span className="font-medium">Radius:</span> {zone.radius_miles} mi
              </div>
              {filters.zoneId === "ALL" ? (
                <>
                  <div>
                    <span className="font-medium">Members:</span> {zoneCounts[zone.zone_id] ?? 0}
                  </div>
                  <div>
                    <span className="font-medium">Categories:</span>{" "}
                    {Object.entries(zoneCategoryRollups[zone.zone_id] ?? {})
                      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                      .map(([category, count]) => `${count} ${category}`)
                      .join(" · ") || "No members yet"}
                  </div>
                </>
              ) : null}
            </div>

            {zone.notes ? <p className="mt-4 text-sm text-neutral-600">{zone.notes}</p> : null}
          </article>
        ))}
      </section>

      {filters.zoneId !== "ALL" ? (
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Salon Members</h2>
          </div>

          {visibleMembers.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-neutral-600">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Subtype</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Anchor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {visibleMembers.map((member) => (
                    <tr key={member.location_id} className="align-top text-neutral-800">
                      <td className="px-4 py-3 font-medium">{member.name}</td>
                      <td className="px-4 py-3">{member.category}</td>
                      <td className="px-4 py-3">{member.subtype}</td>
                      <td className="px-4 py-3">
                        {[member.address, member.city, member.state, member.zip].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-4 py-3">{member.priority_score}</td>
                      <td className="px-4 py-3">{member.is_anchor ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-neutral-600">
              No salon members are currently assigned to this zone.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
