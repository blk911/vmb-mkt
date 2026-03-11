"use client";

import { useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import type {
  ApprovedLiveUnit,
  BeautyRegion,
  BeautyZone,
  BeautyZoneCluster,
  EnrichedBeautyZoneMember,
} from "@/lib/markets";

type SortKey = "upgraded_priority_score" | "name" | "category";

const CATEGORY_FILTERS = ["All", "Hair", "Nail", "Esthe", "Barber", "Spa", "Beauty"] as const;
const SUBTYPE_FILTERS = ["All", "Storefront", "Suite"] as const;

function formatProfessionMix(member: EnrichedBeautyZoneMember) {
  return [
    `Hair ${member.nearby_dora_hair_count ?? 0}`,
    `Nail ${member.nearby_dora_nail_count ?? 0}`,
    `Esthe ${member.nearby_dora_esthe_count ?? 0}`,
    `Barber ${member.nearby_dora_barber_count ?? 0}`,
    `Spa ${member.nearby_dora_spa_count ?? 0}`,
  ].join(" · ");
}

function formatRawProfessionMix(member: EnrichedBeautyZoneMember) {
  const entries = Object.entries(member.nearby_dora_profession_mix_raw ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "No raw DORA labels";
  return entries.map(([label, count]) => `${label}: ${count}`).join(" · ");
}

function densityBadgeClass(total: number) {
  if (total >= 25) return "bg-violet-100 text-violet-800";
  if (total >= 10) return "bg-amber-100 text-amber-800";
  if (total >= 1) return "bg-sky-100 text-sky-800";
  return "bg-neutral-100 text-neutral-600";
}

type Props = {
  regions: BeautyRegion[];
  zones: BeautyZone[];
  members: EnrichedBeautyZoneMember[];
  clusters: BeautyZoneCluster[];
  approvedLiveUnits: ApprovedLiveUnit[];
};

export default function MarketsClient({ regions, zones, members, clusters, approvedLiveUnits }: Props) {
  const [filters, setFilters] = useState({
    regionId: "DEN",
    zoneId: "ALL",
  });
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [subtypeFilter, setSubtypeFilter] = useState<(typeof SUBTYPE_FILTERS)[number]>("All");
  const [sortKey, setSortKey] = useState<SortKey>("upgraded_priority_score");

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
        if (sortKey === "upgraded_priority_score") {
          if (b.upgraded_priority_score !== a.upgraded_priority_score) {
            return b.upgraded_priority_score - a.upgraded_priority_score;
          }
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

  const selectedZoneMembers = useMemo(() => {
    if (filters.zoneId === "ALL") return [];
    return members.filter((member) => member.zone_id === filters.zoneId);
  }, [filters.zoneId, members]);

  const selectedZoneSummary = useMemo(() => {
    return {
      total: selectedZoneMembers.length,
      hair: selectedZoneMembers.filter((member) => member.category === "hair").length,
      nail: selectedZoneMembers.filter((member) => member.category === "nail").length,
      esthe: selectedZoneMembers.filter((member) => member.category === "esthe").length,
      barber: selectedZoneMembers.filter((member) => member.category === "barber").length,
      spa: selectedZoneMembers.filter((member) => member.category === "spa").length,
      suite: selectedZoneMembers.filter((member) => member.subtype === "suite").length,
    };
  }, [selectedZoneMembers]);

  const selectedZoneApprovedLiveUnits = useMemo(() => {
    if (filters.zoneId === "ALL") return [];
    return approvedLiveUnits
      .filter((unit) => unit.linked_zones.some((zone) => zone.zone_id === filters.zoneId))
      .sort((a, b) => {
        if (b.entity_score !== a.entity_score) return b.entity_score - a.entity_score;
        return a.name_display.localeCompare(b.name_display);
      });
  }, [approvedLiveUnits, filters.zoneId]);

  const selectedZoneClusters = useMemo(() => {
    if (filters.zoneId === "ALL") return [];
    return clusters
      .filter((cluster) => cluster.zone_id === filters.zoneId)
      .sort((a, b) => {
        if (b.member_count !== a.member_count) return b.member_count - a.member_count;
        return a.cluster_rank - b.cluster_rank;
      });
  }, [clusters, filters.zoneId]);

  const topTargets = useMemo(() => {
    return [...selectedZoneMembers]
      .sort((a, b) => {
        if (b.upgraded_priority_score !== a.upgraded_priority_score) {
          return b.upgraded_priority_score - a.upgraded_priority_score;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [selectedZoneMembers]);

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
              {[
                { label: "Total Members", value: selectedZoneSummary.total },
                { label: "Hair", value: selectedZoneSummary.hair },
                { label: "Nail", value: selectedZoneSummary.nail },
                { label: "Esthe", value: selectedZoneSummary.esthe },
                { label: "Barber", value: selectedZoneSummary.barber },
                { label: "Spa", value: selectedZoneSummary.spa },
                { label: "Suite", value: selectedZoneSummary.suite },
                { label: "Approved Units", value: selectedZoneApprovedLiveUnits.length },
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
                  <option value="upgraded_priority_score">Priority Score</option>
                  <option value="name">Name</option>
                  <option value="category">Category</option>
                </select>
              </label>
            </div>
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Clusters</h3>
                <p className="text-xs text-neutral-500">
                  {selectedZoneClusters.length} clusters · largest {selectedZoneClusters[0]?.member_count ?? 0} members
                </p>
              </div>
            </div>

            {selectedZoneClusters.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedZoneClusters.map((cluster) => (
                  <article
                    key={cluster.cluster_id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Cluster #{cluster.cluster_rank}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-neutral-900">
                          {cluster.member_count} businesses
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          cluster.has_suite
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {cluster.has_suite ? "Has suite" : "No suite"}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-neutral-700">
                      <div>
                        <span className="font-medium">Categories:</span>{" "}
                        {cluster.categories_present.join(", ") || "unknown"}
                      </div>
                      <div className="mt-2">
                        <span className="font-medium">Top members:</span>{" "}
                        {cluster.top_member_names.join(", ")}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">No clusters detected for this zone.</p>
            )}
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Top Targets</h3>
                <p className="text-xs text-neutral-500">Top 5 businesses after upgraded scoring</p>
              </div>
            </div>

            {topTargets.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {topTargets.map((member, index) => (
                  <article
                    key={member.location_id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Rank #{index + 1}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">{member.name}</div>
                    <div className="mt-1 text-xs text-neutral-600">
                      {member.category} · {member.subtype}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {member.upgraded_priority_score} pts
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.is_anchor
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {member.is_anchor ? "Anchor" : "Standard"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">No top targets available for this zone.</p>
            )}
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
                    <th className="px-4 py-3 font-medium">DORA Density</th>
                    <th className="px-4 py-3 font-medium">Profession Mix</th>
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
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${densityBadgeClass(
                            member.nearby_dora_licenses_total ?? 0
                          )}`}
                          title={`Radius ${member.dora_density_radius_miles ?? 0} mi • ${member.dora_density_profile ?? "custom"}`}
                        >
                          {member.nearby_dora_licenses_total ?? 0} nearby
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600" title={formatRawProfessionMix(member)}>
                        {formatProfessionMix(member)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            member.upgraded_priority_score >= 9
                              ? "bg-emerald-100 text-emerald-800"
                              : member.upgraded_priority_score >= 6
                                ? "bg-blue-100 text-blue-800"
                                : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {member.upgraded_priority_score}
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

          <div className="border-t border-neutral-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Approved Live Units</h3>
                <p className="text-xs text-neutral-500">
                  Reviewed-and-approved entity layer for this selected zone
                </p>
              </div>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {selectedZoneApprovedLiveUnits.length} approved
              </span>
            </div>

            {selectedZoneApprovedLiveUnits.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedZoneApprovedLiveUnits.map((unit) => (
                  <article
                    key={unit.live_unit_id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">{unit.name_display}</div>
                        <div className="mt-1 text-xs text-neutral-600">
                          {unit.operational_category} · {unit.subtype}
                        </div>
                      </div>
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {unit.entity_score}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        {unit.confidence}
                      </span>
                      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        {unit.signal_mix}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-neutral-600">
                      {[unit.city, unit.state, unit.zip].filter(Boolean).join(", ")}
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">{unit.explanation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">No approved live units linked to this zone yet.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
