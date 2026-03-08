"use client";

import { useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import type { BeautyRegion, BeautyZone, BeautyZoneMember } from "@/lib/markets";

type SortKey = "priority_score" | "name" | "category";

const CATEGORY_FILTERS = ["All", "Nail", "Hair", "Spa", "Brow", "Lash", "Barber", "Beauty"] as const;
const SUBTYPE_FILTERS = ["All", "Storefront", "Suite"] as const;

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
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [subtypeFilter, setSubtypeFilter] = useState<(typeof SUBTYPE_FILTERS)[number]>("All");
  const [sortKey, setSortKey] = useState<SortKey>("priority_score");

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

  const zoneSubtypeRollups = useMemo(() => {
    return members.reduce<Record<string, Record<string, number>>>((acc, member) => {
      const zoneRollup = (acc[member.zone_id] ??= {});
      zoneRollup[member.subtype] = (zoneRollup[member.subtype] ?? 0) + 1;
      return acc;
    }, {});
  }, [members]);

  const visibleMembers = useMemo(() => {
    if (filters.zoneId === "ALL") return [];

    return members
      .filter((member) => member.zone_id === filters.zoneId)
      .filter((member) => {
        if (categoryFilter !== "All" && member.category !== categoryFilter.toLowerCase()) return false;
        if (subtypeFilter !== "All" && member.subtype !== subtypeFilter.toLowerCase()) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "priority_score") {
          if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
          return a.name.localeCompare(b.name);
        }
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "category") {
          const categoryCompare = a.category.localeCompare(b.category);
          if (categoryCompare !== 0) return categoryCompare;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [categoryFilter, filters.zoneId, members, sortKey, subtypeFilter]);

  const selectedZoneSummary = useMemo(() => {
    const selectedZoneMembers = filters.zoneId === "ALL"
      ? []
      : members.filter((member) => member.zone_id === filters.zoneId);

    return {
      total: selectedZoneMembers.length,
      nail: selectedZoneMembers.filter((member) => member.category === "nail").length,
      hair: selectedZoneMembers.filter((member) => member.category === "hair").length,
      spa: selectedZoneMembers.filter((member) => member.category === "spa").length,
      suite: selectedZoneMembers.filter((member) => member.subtype === "suite").length,
    };
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
          <article key={zone.zone_id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
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
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Total Members
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-neutral-900">
                      {zoneCounts[zone.zone_id] ?? 0}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Categories
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: "nail", count: zoneCategoryRollups[zone.zone_id]?.nail ?? 0 },
                        { label: "hair", count: zoneCategoryRollups[zone.zone_id]?.hair ?? 0 },
                        { label: "spa", count: zoneCategoryRollups[zone.zone_id]?.spa ?? 0 },
                        { label: "suite", count: zoneSubtypeRollups[zone.zone_id]?.suite ?? 0 },
                      ].map((item) => {
                        const muted = item.count === 0;
                        return (
                          <span
                            key={item.label}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                              muted
                                ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                                : "border-neutral-300 bg-white text-neutral-700"
                            }`}
                          >
                            <span className="font-semibold">{item.count}</span>
                            <span>{item.label}</span>
                          </span>
                        );
                      })}
                    </div>
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

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total Members", value: selectedZoneSummary.total },
                { label: "Nail", value: selectedZoneSummary.nail },
                { label: "Hair", value: selectedZoneSummary.hair },
                { label: "Spa", value: selectedZoneSummary.spa },
                { label: "Suite", value: selectedZoneSummary.suite },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {item.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="min-w-[180px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Category
                </span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as (typeof CATEGORY_FILTERS)[number])}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                >
                  {CATEGORY_FILTERS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[180px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Subtype
                </span>
                <select
                  value={subtypeFilter}
                  onChange={(e) => setSubtypeFilter(e.target.value as (typeof SUBTYPE_FILTERS)[number])}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                >
                  {SUBTYPE_FILTERS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[180px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Sort
                </span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                >
                  <option value="priority_score">Priority Score</option>
                  <option value="name">Name</option>
                  <option value="category">Category</option>
                </select>
              </label>
            </div>
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
                    <th className="px-4 py-3 font-medium">Priority Score</th>
                    <th className="px-4 py-3 font-medium">Is Anchor</th>
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
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            member.priority_score >= 7
                              ? "bg-emerald-100 text-emerald-800"
                              : member.priority_score >= 4
                                ? "bg-blue-100 text-blue-800"
                                : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {member.priority_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            member.is_anchor
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {member.is_anchor ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-neutral-600">
              No matched businesses yet for this zone.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
