"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import { PresenceBadges, formatBookingProviderLabel } from "@/components/admin/PresenceBadges";
import type {
  ApprovedLiveUnit,
  BeautyRegion,
  BeautyZone,
  BeautyZoneCluster,
  EnrichedBeautyZoneMember,
} from "@/lib/markets";
import {
  buildMarketsListPath,
  buildMemberDetailPath,
  marketsListPathsEqual,
  marketsUrlStateKey,
  type MarketsSortDir as SortDir,
  type MarketsSortKey as SortKey,
  type MarketsUrlState,
} from "./_lib/marketsUrlState";
import {
  clusterDisplayTitle,
  computeClusterActiveMetrics,
  type ClusterActiveMetrics,
} from "./_lib/marketsClusterActive";
import {
  compareDefaultSalonSort,
  compareTopTargetRank,
  memberHasActivePresence,
} from "./_lib/marketsActiveRank";

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

function memberAddressLine(member: EnrichedBeautyZoneMember) {
  return [member.address, member.city, member.state, member.zip].filter(Boolean).join(", ");
}

function professionMixTotal(member: EnrichedBeautyZoneMember) {
  return (
    (member.nearby_dora_hair_count ?? 0) +
    (member.nearby_dora_nail_count ?? 0) +
    (member.nearby_dora_esthe_count ?? 0) +
    (member.nearby_dora_barber_count ?? 0) +
    (member.nearby_dora_spa_count ?? 0)
  );
}

function defaultSortDir(key: SortKey): SortDir {
  switch (key) {
    case "upgraded_priority_score":
    case "dora_density":
    case "profession_mix":
    case "is_anchor":
      return "desc";
    default:
      return "asc";
  }
}

function compareMembers(a: EnrichedBeautyZoneMember, b: EnrichedBeautyZoneMember, sortKey: SortKey, sortDir: SortDir): number {
  const s = sortDir === "asc" ? 1 : -1;
  let cmp = 0;

  if (sortKey === "upgraded_priority_score") {
    cmp = a.upgraded_priority_score - b.upgraded_priority_score;
  } else if (sortKey === "name") {
    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  } else if (sortKey === "category") {
    cmp = a.category.localeCompare(b.category);
  } else if (sortKey === "subtype") {
    cmp = a.subtype.localeCompare(b.subtype);
  } else if (sortKey === "address") {
    cmp = memberAddressLine(a).localeCompare(memberAddressLine(b));
  } else if (sortKey === "dora_density") {
    cmp = (a.nearby_dora_licenses_total ?? 0) - (b.nearby_dora_licenses_total ?? 0);
  } else if (sortKey === "profession_mix") {
    cmp = professionMixTotal(a) - professionMixTotal(b);
  } else if (sortKey === "is_anchor") {
    cmp = (a.is_anchor ? 1 : 0) - (b.is_anchor ? 1 : 0);
  }

  if (cmp !== 0) return cmp * s;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** When primary keys tie, anchors sort above non-anchors (does not alter explicit Name sort). */
function compareMembersWithAnchorTiebreak(
  a: EnrichedBeautyZoneMember,
  b: EnrichedBeautyZoneMember,
  sortKey: SortKey,
  sortDir: SortDir
): number {
  const cmp = compareMembers(a, b, sortKey, sortDir);
  if (cmp !== 0) return cmp;
  if (sortKey === "name") return 0;
  return (b.is_anchor ? 1 : 0) - (a.is_anchor ? 1 : 0);
}

function SortTh({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (c: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      className="px-4 py-3 font-medium"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex max-w-full items-center gap-1 text-left uppercase tracking-wide text-neutral-600 transition hover:text-neutral-900"
        title={`Sort by ${label} (click to reverse)`}
      >
        <span className="min-w-0 break-words">{label}</span>
        {active ? (
          <span aria-hidden className="shrink-0 tabular-nums text-neutral-900">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

type Props = {
  regions: BeautyRegion[];
  zones: BeautyZone[];
  members: EnrichedBeautyZoneMember[];
  clusters: BeautyZoneCluster[];
  approvedLiveUnits: ApprovedLiveUnit[];
  initialUrlState: MarketsUrlState;
};

export default function MarketsClient({
  regions,
  zones,
  members,
  clusters,
  approvedLiveUnits,
  initialUrlState,
}: Props) {
  const [filters, setFilters] = useState({
    regionId: initialUrlState.regionId,
    zoneId: initialUrlState.zoneId,
  });
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>(initialUrlState.category);
  const [subtypeFilter, setSubtypeFilter] = useState<(typeof SUBTYPE_FILTERS)[number]>(initialUrlState.subtype);
  const [sortKey, setSortKey] = useState<SortKey>(initialUrlState.sort);
  const [sortDir, setSortDir] = useState<SortDir>(initialUrlState.sortDir);
  /** Clusters: OPEN/CLOSE toggle. Loads collapsed; control reads OPEN until expanded. */
  const [clustersOpen, setClustersOpen] = useState(false);
  /** Top Targets: same — collapsed on load. */
  const [topTargetsOpen, setTopTargetsOpen] = useState(false);
  /** Hot Clusters panel — collapsed on load. */
  const [hotClustersOpen, setHotClustersOpen] = useState(false);
  /** Client-only filter for site_identity presence fields on members (optional in JSON). */
  const [presenceFilter, setPresenceFilter] = useState<string>("all");
  /** All rows vs “active” (IG or booking provider per reviewer spec). */
  const [activityScope, setActivityScope] = useState<"all" | "active">("all");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPathWithQuery = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  const marketsUrlState = useMemo(
    (): MarketsUrlState => ({
      regionId: filters.regionId,
      zoneId: filters.zoneId,
      category: categoryFilter,
      subtype: subtypeFilter,
      sort: sortKey,
      sortDir,
    }),
    [filters.regionId, filters.zoneId, categoryFilter, subtypeFilter, sortKey, sortDir]
  );

  /** Keep filters in sync when URL-driven props change (e.g. client nav) even if React reuses the tree. */
  const initialUrlStateKey = marketsUrlStateKey(initialUrlState);
  useEffect(() => {
    setFilters({ regionId: initialUrlState.regionId, zoneId: initialUrlState.zoneId });
    setCategoryFilter(initialUrlState.category);
    setSubtypeFilter(initialUrlState.subtype);
    setSortKey(initialUrlState.sort);
    setSortDir(initialUrlState.sortDir);
    // Only re-run when URL-derived identity changes; RSC may pass a new object each render with the same key.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialUrlState fields are implied by initialUrlStateKey
  }, [initialUrlStateKey]);

  /** Keep the address bar aligned with dropdown/table state (same canonical path as quick links). */
  useEffect(() => {
    const next = buildMarketsListPath(marketsUrlState);
    if (!marketsListPathsEqual(next, currentPathWithQuery)) {
      router.replace(next);
    }
  }, [marketsUrlState, currentPathWithQuery, router]);

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

  const visibleMembers = useMemo(() => {
    if (filters.zoneId === "ALL") return [];

    return members
      .filter((member) => member.zone_id === filters.zoneId)
      .filter((member) => {
        if (activityScope === "active" && !memberHasActivePresence(member)) return false;
        if (categoryFilter !== "All" && member.category !== categoryFilter.toLowerCase()) return false;
        if (subtypeFilter !== "All" && member.subtype !== subtypeFilter.toLowerCase()) return false;
        if (presenceFilter === "has_ig")
          return !!(member.instagram_url?.trim() || member.instagram_handle?.trim());
        if (presenceFilter === "has_booking")
          return !!(member.booking_url?.trim() || member.booking_provider?.trim());
        if (presenceFilter.startsWith("bp:")) {
          const want = presenceFilter.slice(3).toLowerCase();
          return (member.booking_provider || "").trim().toLowerCase() === want;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "upgraded_priority_score" && sortDir === "desc") {
          return compareDefaultSalonSort(a, b);
        }
        return compareMembersWithAnchorTiebreak(a, b, sortKey, sortDir);
      });
  }, [
    activityScope,
    categoryFilter,
    filters.zoneId,
    members,
    presenceFilter,
    sortDir,
    sortKey,
    subtypeFilter,
  ]);

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

  const clusterMetricsById = useMemo(() => {
    const map = new Map<string, ClusterActiveMetrics>();
    for (const cl of selectedZoneClusters) {
      const mems = selectedZoneMembers.filter((m) => m.cluster_id === cl.cluster_id);
      map.set(cl.cluster_id, computeClusterActiveMetrics(cl, mems));
    }
    return map;
  }, [selectedZoneClusters, selectedZoneMembers]);

  const hotClusters = useMemo(() => {
    return [...selectedZoneClusters]
      .map((cluster) => ({
        cluster,
        metrics: clusterMetricsById.get(cluster.cluster_id)!,
        mems: selectedZoneMembers.filter((m) => m.cluster_id === cluster.cluster_id),
      }))
      .sort((a, b) => {
        const sc = b.metrics.cluster_active_score - a.metrics.cluster_active_score;
        if (sc !== 0) return sc;
        if (b.cluster.member_count !== a.cluster.member_count) return b.cluster.member_count - a.cluster.member_count;
        const anch = (b.metrics.has_anchor ? 1 : 0) - (a.metrics.has_anchor ? 1 : 0);
        if (anch !== 0) return anch;
        const suite = (b.cluster.has_suite ? 1 : 0) - (a.cluster.has_suite ? 1 : 0);
        if (suite !== 0) return suite;
        return a.cluster.cluster_rank - b.cluster.cluster_rank;
      })
      .slice(0, 5);
  }, [clusterMetricsById, selectedZoneClusters, selectedZoneMembers]);

  const bookingProviderFilterOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of selectedZoneMembers) {
      const p = m.booking_provider?.trim().toLowerCase();
      if (p) s.add(p);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [selectedZoneMembers]);

  const topTargets = useMemo(() => {
    return [...selectedZoneMembers].sort(compareTopTargetRank).slice(0, 5);
  }, [selectedZoneMembers]);

  function toggleColumnSort(column: SortKey) {
    if (sortKey === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir(defaultSortDir(column));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Markets</h1>

      <MarketZoneFilters
        key={`${filters.regionId}-${filters.zoneId}`}
        regions={regions}
        zones={zones}
        initialRegionId={filters.regionId}
        initialZoneId={filters.zoneId}
        onChange={setFilters}
      />

      {filters.zoneId === "ALL" ? (
        <section aria-label="Zone quick links">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Quick links — open a corridor (live links to that market view)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleZones.map((zone) => {
              const count = zoneCounts[zone.zone_id] ?? 0;
              const href = buildMarketsListPath({ ...marketsUrlState, zoneId: zone.zone_id });
              return (
                <Link
                  key={zone.zone_id}
                  href={href}
                  prefetch
                  aria-label={`Open ${zone.zone_name} corridor, ${count} members`}
                  title={`Open corridor: ${zone.zone_name}`}
                  className="group block rounded-lg border border-neutral-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-sky-500 hover:bg-sky-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Corridor</span>
                  <div className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-[13px] font-semibold leading-snug text-neutral-900 group-hover:underline group-hover:decoration-sky-500/80 group-hover:underline-offset-2">
                    {zone.zone_name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500" title={zone.market}>
                    {zone.market}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums leading-none text-neutral-900">{count}</span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">members</span>
                    </div>
                    <span
                      className="text-neutral-400 transition group-hover:text-sky-600"
                      aria-hidden
                    >
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

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
              <label className="min-w-[140px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Activity
                </span>
                <select
                  value={activityScope}
                  onChange={(e) => setActivityScope(e.target.value as "all" | "active")}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                  title="All members, or only rows with Instagram or booking provider"
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                </select>
              </label>
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

              <label className="min-w-[200px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Presence (site identity)
                </span>
                <select
                  value={presenceFilter}
                  onChange={(e) => setPresenceFilter(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                  title="Filter by optional Instagram / booking fields merged from site_identity pipeline"
                >
                  <option value="all">All</option>
                  <option value="has_ig">Has Instagram</option>
                  <option value="has_booking">Has booking link</option>
                  {bookingProviderFilterOptions.map((p) => (
                    <option key={p} value={`bp:${p}`}>
                      Booking: {formatBookingProviderLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Sort via column headers (↑ / ↓). Default Priority column: active presence &amp; anchors first, then
              highest upgraded score.
            </p>
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Clusters</h3>
                <p className="text-xs text-neutral-500">
                  {selectedZoneClusters.length} clusters · largest {selectedZoneClusters[0]?.member_count ?? 0} members
                  {" · "}
                  <span className="text-neutral-400">
                    Sorted by size here; use Hot Clusters below for presence-ranked picks.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClustersOpen((o) => !o)}
                aria-expanded={clustersOpen}
                className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-800 transition hover:bg-neutral-50"
              >
                {clustersOpen ? "CLOSE" : "OPEN"}
              </button>
            </div>

            {clustersOpen ? (
              selectedZoneClusters.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selectedZoneClusters.map((cluster) => {
                    const met = clusterMetricsById.get(cluster.cluster_id);
                    return (
                      <article
                        key={cluster.cluster_id}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Cluster #{cluster.cluster_rank}
                            </div>
                            <div className="mt-1 text-lg font-semibold text-neutral-900">
                              {cluster.member_count} businesses
                            </div>
                            {met ? (
                              <div className="mt-1.5 inline-flex rounded bg-violet-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-900">
                                Active score {met.cluster_active_score}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {met?.has_anchor ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                Anchor
                              </span>
                            ) : null}
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
                          {met ? (
                            <div className="mt-2 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                              <span className="font-semibold text-neutral-700">Presence</span> (site identity)
                              <div className="mt-1 space-y-0.5">
                                <div>
                                  Active members: {met.active_member_count} / {cluster.member_count}
                                </div>
                                <div>
                                  IG count: {met.instagram_member_count} · Booking count: {met.booking_member_count}
                                </div>
                                <div>
                                  Providers:{" "}
                                  {met.cluster_distinct_booking_providers.length
                                    ? met.cluster_distinct_booking_providers.map(formatBookingProviderLabel).join(", ")
                                    : "—"}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">No clusters detected for this zone.</p>
              )
            ) : null}
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Hot Clusters</h3>
                <p className="text-xs text-neutral-500">
                  Top clusters by active presence and density — full cluster list above stays size-sorted
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHotClustersOpen((o) => !o)}
                aria-expanded={hotClustersOpen}
                className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-800 transition hover:bg-neutral-50"
              >
                {hotClustersOpen ? "CLOSE" : "OPEN"}
              </button>
            </div>

            {hotClustersOpen ? (
              hotClusters.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {hotClusters.map(({ cluster, metrics: met, mems }, index) => (
                    <article
                      key={cluster.cluster_id}
                      className="rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                        Hot #{index + 1}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-900" title={clusterDisplayTitle(cluster, mems)}>
                        {clusterDisplayTitle(cluster, mems)}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-600">
                        {cluster.member_count} businesses · Active {met.active_member_count}/{cluster.member_count}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-violet-900">
                          Score {met.cluster_active_score}
                        </span>
                        {met.has_anchor ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Anchor
                          </span>
                        ) : null}
                        {cluster.has_suite ? (
                          <span className="inline-flex rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Suite
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] text-neutral-600">
                        IG {met.instagram_member_count} · Booking {met.booking_member_count}
                        {met.cluster_distinct_booking_providers.length ? (
                          <span className="mt-1 block text-neutral-700">
                            {met.cluster_distinct_booking_providers.map(formatBookingProviderLabel).join(", ")}
                          </span>
                        ) : (
                          <span className="mt-1 block text-neutral-500">No providers</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">No clusters in this zone.</p>
              )
            ) : null}
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Top Targets</h3>
                <p className="text-xs text-neutral-500">
                  Top 5 by presence, anchors, booking, then upgraded score
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTopTargetsOpen((o) => !o)}
                aria-expanded={topTargetsOpen}
                className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-800 transition hover:bg-neutral-50"
              >
                {topTargetsOpen ? "CLOSE" : "OPEN"}
              </button>
            </div>

            {topTargetsOpen ? (
              topTargets.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {topTargets.map((member, index) => (
                    <article
                      key={member.location_id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Rank #{index + 1}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">
                        <Link
                          href={buildMemberDetailPath(member.location_id, marketsUrlState)}
                          className="text-sky-700 underline-offset-2 hover:underline"
                        >
                          {member.name}
                        </Link>
                        {memberHasActivePresence(member) ? (
                          <span className="ml-1.5 inline-flex align-middle rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900">
                            Active
                          </span>
                        ) : null}
                      </div>
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
                      <div className="mt-2 min-h-[1.5rem]">
                        <PresenceBadges member={member} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">No top targets available for this zone.</p>
              )
            ) : null}
          </div>

          {visibleMembers.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-neutral-600">
                    <SortTh
                      column="name"
                      label="Name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="category"
                      label="Category"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="subtype"
                      label="Subtype"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="address"
                      label="Address"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="dora_density"
                      label="DORA Density"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="profession_mix"
                      label="Profession Mix"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <SortTh
                      column="upgraded_priority_score"
                      label="Priority Score"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                    <th className="px-4 py-3 font-medium uppercase tracking-wide text-neutral-600">Presence</th>
                    <SortTh
                      column="is_anchor"
                      label="Is Anchor"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {visibleMembers.map((member) => (
                    <tr key={member.location_id} className="align-top text-neutral-800">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <Link
                            href={buildMemberDetailPath(member.location_id, marketsUrlState)}
                            className="text-sky-700 underline-offset-2 hover:underline"
                          >
                            {member.name}
                          </Link>
                          {memberHasActivePresence(member) ? (
                            <span
                              className="inline-flex shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900"
                              title="Instagram or booking provider present"
                            >
                              Active
                            </span>
                          ) : null}
                        </div>
                      </td>
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
                      <td className="max-w-[14rem] px-4 py-3">
                        <PresenceBadges member={member} />
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
