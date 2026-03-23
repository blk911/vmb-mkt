"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MarketZoneFilters from "@/components/admin/MarketZoneFilters";
import { compareZoneIdsForDisplay, getZoneDisplayLabel } from "@/lib/geo/target-zones";
import { ClusterEvidencePanel } from "@/components/admin/ClusterEvidencePanel";
import { GrayResolutionBadge } from "@/components/admin/GrayResolution";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
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
  buildSalesTargetPath,
  defaultMarketsUrlState,
  marketsListPathsEqual,
  marketsUrlStateKey,
  type MarketsSortDir as SortDir,
  type MarketsSortKey as SortKey,
  type MarketsUrlState,
} from "./_lib/marketsUrlState";
import { deriveZoneOpsSummaries, filterMembersByWorkPreset, getZoneOpsSummaryForId } from "@/lib/markets/zone-ops-logic";
import type { MarketsWorkPreset } from "@/lib/markets/zone-ops-types";
import ZoneOpsStats from "@/app/admin/markets/_components/ZoneOpsStats";
import ZoneWorkPacketHeader from "@/app/admin/markets/_components/ZoneWorkPacketHeader";
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
    case "presence":
    case "is_anchor":
      return "desc";
    default:
      return "asc";
  }
}

/** 0–3: core active (IG/booking) + path enrichment; higher = stronger signals. */
function presenceSortValue(m: EnrichedBeautyZoneMember): number {
  const active = memberHasActivePresence(m) ? 2 : 0;
  const path = m.path_enrichment_matched === true ? 1 : 0;
  return active + path;
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
  } else if (sortKey === "presence") {
    cmp = presenceSortValue(a) - presenceSortValue(b);
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
  if (sortKey === "name" || sortKey === "presence") return 0;
  return (b.is_anchor ? 1 : 0) - (a.is_anchor ? 1 : 0);
}

function SortTh({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
  headerTitle,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (c: SortKey) => void;
  /** Extra context for the column (e.g. Presence vs path); shown on hover of header cell. */
  headerTitle?: string;
}) {
  const active = sortKey === column;
  return (
    <th
      className="px-4 py-3 font-medium"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      title={headerTitle}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex max-w-full items-center gap-1 text-left uppercase tracking-wide text-neutral-600 transition hover:text-neutral-900"
        title={headerTitle ? `${headerTitle} — Sort (click to reverse)` : `Sort by ${label} (click to reverse)`}
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

/** Compact strip card for Clusters / Hidden / Hot / Top Targets (toggle only — content renders below). */
function ClusterInsightsSummaryCard({
  title,
  count,
  subtitle,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex min-h-[5.25rem] flex-col rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
        open
          ? "border-sky-400 bg-white shadow-sm ring-1 ring-sky-200/70"
          : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{title}</span>
      <span className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-neutral-900">{count}</span>
      <span className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-neutral-500">{subtitle}</span>
      <span className="mt-auto pt-1 text-[10px] font-semibold text-sky-700">{open ? "Close" : "Open"}</span>
    </button>
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
  const [workPreset, setWorkPreset] = useState<MarketsWorkPreset | null>(initialUrlState.workPreset ?? null);
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
  /** Hidden Opportunity Clusters — collapsed on load. */
  const [hiddenOpportunityOpen, setHiddenOpportunityOpen] = useState(false);
  /** Filtered-zone stat summary — collapsed on load (compact strip when closed). */
  const [zoneSummaryOpen, setZoneSummaryOpen] = useState(false);
  /** Client-only filter for site_identity presence fields on members (optional in JSON). */
  const [presenceFilter, setPresenceFilter] = useState<string>("all");
  /** Optional: members with path_enrichment_matched (supplemental layer). */
  const [pathEnrichmentFilter, setPathEnrichmentFilter] = useState<"all" | "has_path">("all");
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
      workPreset,
    }),
    [filters.regionId, filters.zoneId, categoryFilter, subtypeFilter, sortKey, sortDir, workPreset]
  );

  /** Keep filters in sync when URL-driven props change (e.g. client nav) even if React reuses the tree. */
  const initialUrlStateKey = marketsUrlStateKey(initialUrlState);
  useEffect(() => {
    setFilters({ regionId: initialUrlState.regionId, zoneId: initialUrlState.zoneId });
    setCategoryFilter(initialUrlState.category);
    setSubtypeFilter(initialUrlState.subtype);
    setSortKey(initialUrlState.sort);
    setSortDir(initialUrlState.sortDir);
    setWorkPreset(initialUrlState.workPreset ?? null);
    // Only re-run when URL-derived identity changes; RSC may pass a new object each render with the same key.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialUrlState fields are implied by initialUrlStateKey
  }, [initialUrlStateKey]);

  const handleZoneFiltersChange = useCallback(
    (next: { regionId: string; zoneId: string }) => {
      if (next.regionId !== filters.regionId || next.zoneId !== filters.zoneId) {
        setWorkPreset(null);
      }
      setFilters(next);
    },
    [filters.regionId, filters.zoneId]
  );

  /** Keep the address bar aligned with dropdown/table state (same canonical path as quick links). */
  useEffect(() => {
    const next = buildMarketsListPath(marketsUrlState);
    if (!marketsListPathsEqual(next, currentPathWithQuery)) {
      router.replace(next);
    }
  }, [marketsUrlState, currentPathWithQuery, router]);

  const visibleZones = useMemo(() => {
    return zones
      .filter((zone) => {
        if (zone.region_id !== filters.regionId) return false;
        if (filters.zoneId !== "ALL" && zone.zone_id !== filters.zoneId) return false;
        return true;
      })
      .slice()
      .sort((a, b) => compareZoneIdsForDisplay(a.zone_id, b.zone_id));
  }, [filters, zones]);

  const zoneCounts = useMemo(() => {
    return members.reduce<Record<string, number>>((acc, member) => {
      acc[member.zone_id] = (acc[member.zone_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [members]);

  const zoneOpsSummaries = useMemo(() => deriveZoneOpsSummaries(members, clusters, zones), [members, clusters, zones]);

  const selectedZone = useMemo(
    () => (filters.zoneId === "ALL" ? undefined : zones.find((z) => z.zone_id === filters.zoneId)),
    [filters.zoneId, zones]
  );

  const buildZoneWorkPath = useCallback(
    (zoneId: string, preset: MarketsWorkPreset | null) =>
      buildMarketsListPath({
        ...defaultMarketsUrlState(),
        regionId: filters.regionId,
        zoneId,
        category: "All",
        subtype: "All",
        sort: "upgraded_priority_score",
        sortDir: "desc",
        workPreset: preset,
      }),
    [filters.regionId]
  );

  const visibleMembers = useMemo(() => {
    if (filters.zoneId === "ALL") return [];

    const zoneScoped = members.filter((member) => member.zone_id === filters.zoneId);
    const presetScoped = filterMembersByWorkPreset(zoneScoped, workPreset);

    return presetScoped
      .filter((member) => {
        if (activityScope === "active" && !memberHasActivePresence(member)) return false;
        if (categoryFilter !== "All" && member.category !== categoryFilter.toLowerCase()) return false;
        if (subtypeFilter !== "All" && member.subtype !== subtypeFilter.toLowerCase()) return false;
        if (presenceFilter === "has_ig") {
          if (!member.instagram_url?.trim() && !member.instagram_handle?.trim()) return false;
        } else if (presenceFilter === "has_booking") {
          if (!member.booking_url?.trim() && !member.booking_provider?.trim()) return false;
        } else if (presenceFilter.startsWith("bp:")) {
          const want = presenceFilter.slice(3).toLowerCase();
          if ((member.booking_provider || "").trim().toLowerCase() !== want) return false;
        }
        if (pathEnrichmentFilter === "has_path" && member.path_enrichment_matched !== true) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "upgraded_priority_score" && sortDir === "desc") {
          if (workPreset === "top_targets") {
            return compareTopTargetRank(a, b);
          }
          return compareDefaultSalonSort(a, b);
        }
        return compareMembersWithAnchorTiebreak(a, b, sortKey, sortDir);
      });
  }, [
    activityScope,
    categoryFilter,
    filters.zoneId,
    members,
    pathEnrichmentFilter,
    presenceFilter,
    sortDir,
    sortKey,
    subtypeFilter,
    workPreset,
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

  /** All qualifying hidden-opportunity clusters in zone (not capped at 5). */
  const hiddenOpportunityQualifyingCount = useMemo(() => {
    return selectedZoneClusters.reduce((n, cl) => {
      const met = clusterMetricsById.get(cl.cluster_id);
      return met?.is_hidden_opportunity ? n + 1 : n;
    }, 0);
  }, [clusterMetricsById, selectedZoneClusters]);

  /** Path-assisted underrepresentation: active &lt; half of members but ≥2 path-enriched; top 5 by opportunity score. */
  const hiddenOpportunityClusters = useMemo(() => {
    return [...selectedZoneClusters]
      .map((cluster) => ({
        cluster,
        metrics: clusterMetricsById.get(cluster.cluster_id)!,
        mems: selectedZoneMembers.filter((m) => m.cluster_id === cluster.cluster_id),
      }))
      .filter((x) => x.metrics.is_hidden_opportunity)
      .sort((a, b) => {
        const o = b.metrics.cluster_opportunity_score - a.metrics.cluster_opportunity_score;
        if (o !== 0) return o;
        const p = b.metrics.path_enriched_member_count - a.metrics.path_enriched_member_count;
        if (p !== 0) return p;
        return b.cluster.member_count - a.cluster.member_count;
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

  const zoneSummaryOneLine = useMemo(() => {
    const s = selectedZoneSummary;
    const units = selectedZoneApprovedLiveUnits.length;
    return `${s.total} total · Hair ${s.hair} · Nail ${s.nail} · Esthe ${s.esthe} · Barber ${s.barber} · Spa ${s.spa} · Suite ${s.suite} · Approved ${units}`;
  }, [selectedZoneSummary, selectedZoneApprovedLiveUnits.length]);

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold">Markets</h1>
          <Link
            href="/admin/markets/unknown-resolver"
            className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            Nails · Unknown resolver
          </Link>
          <Link
            href="/admin/markets/outreach-queue"
            className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            Outreach queue
          </Link>
        </div>
      </div>

      <MarketZoneFilters
        key={`${filters.regionId}-${filters.zoneId}`}
        regions={regions}
        zones={zones}
        initialRegionId={filters.regionId}
        initialZoneId={filters.zoneId}
        onChange={handleZoneFiltersChange}
      />

      {selectedZone ? (
        <ZoneWorkPacketHeader
          zone={selectedZone}
          summary={getZoneOpsSummaryForId(zoneOpsSummaries, selectedZone.zone_id)}
          workPreset={workPreset}
          onWorkPresetChange={setWorkPreset}
        />
      ) : null}

      {filters.zoneId !== "ALL" ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {!zoneSummaryOpen ? (
                <p className="text-[11px] leading-snug text-neutral-700">
                  <span className="sr-only">Zone summary (collapsed): </span>
                  {zoneSummaryOneLine}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="list" aria-label="Zone member counts">
                  {(
                    [
                      { k: "Total", v: selectedZoneSummary.total },
                      { k: "Hair", v: selectedZoneSummary.hair },
                      { k: "Nail", v: selectedZoneSummary.nail },
                      { k: "Esthe", v: selectedZoneSummary.esthe },
                      { k: "Barber", v: selectedZoneSummary.barber },
                      { k: "Spa", v: selectedZoneSummary.spa },
                      { k: "Suite", v: selectedZoneSummary.suite },
                      { k: "Approved", v: selectedZoneApprovedLiveUnits.length },
                    ] as const
                  ).map(({ k, v }) => (
                    <span
                      key={k}
                      role="listitem"
                      className="inline-flex min-w-0 items-baseline gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{k}</span>
                      <span className="tabular-nums text-xs font-semibold text-neutral-900">{v}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setZoneSummaryOpen((o) => !o)}
              aria-expanded={zoneSummaryOpen}
              className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold text-sky-800 transition hover:bg-white"
            >
              {zoneSummaryOpen ? "Close" : "Open"}
            </button>
          </div>
        </div>
      ) : null}

      {filters.zoneId === "ALL" ? (
        <section aria-label="Zone quick links">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Quick links — open a zone (live links to that market view)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleZones.map((zone) => {
              const count = zoneCounts[zone.zone_id] ?? 0;
              const zoneLabel = getZoneDisplayLabel(zone.zone_id);
              const ops = getZoneOpsSummaryForId(zoneOpsSummaries, zone.zone_id);
              const primaryHref = buildZoneWorkPath(zone.zone_id, "top_targets");
              return (
                <div
                  key={zone.zone_id}
                  className="group flex flex-col rounded-lg border border-neutral-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-sky-500 hover:bg-sky-50/70"
                >
                  <Link
                    href={primaryHref}
                    prefetch
                    aria-label={`Open ${zoneLabel} work packet (top targets), ${count} members`}
                    title={`Open zone work packet: ${zoneLabel}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Zone</span>
                    <div className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-[13px] font-semibold leading-snug text-neutral-900 group-hover:underline group-hover:decoration-sky-500/80 group-hover:underline-offset-2">
                      {zoneLabel}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-500" title={zone.market}>
                      {zone.market}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold tabular-nums leading-none text-neutral-900">{count}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">members</span>
                      </div>
                      <span className="text-neutral-400 transition group-hover:text-sky-600" aria-hidden>
                        →
                      </span>
                    </div>
                  </Link>
                  {ops ? (
                    <div className="mt-2 border-t border-neutral-100 pt-2">
                      <ZoneOpsStats summary={ops} compact />
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-1.5">
                    <Link
                      href={buildZoneWorkPath(zone.zone_id, "top_targets")}
                      className="text-[9px] font-semibold text-sky-700 underline-offset-2 hover:underline"
                      prefetch
                    >
                      Targets
                    </Link>
                    <span className="text-neutral-300" aria-hidden>
                      ·
                    </span>
                    <Link
                      href={buildZoneWorkPath(zone.zone_id, "anchors")}
                      className="text-[9px] font-semibold text-sky-700 underline-offset-2 hover:underline"
                      prefetch
                    >
                      Anchors
                    </Link>
                    <span className="text-neutral-300" aria-hidden>
                      ·
                    </span>
                    <Link
                      href={buildZoneWorkPath(zone.zone_id, "bookable")}
                      className="text-[9px] font-semibold text-sky-700 underline-offset-2 hover:underline"
                      prefetch
                    >
                      Bookable
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {filters.zoneId !== "ALL" ? (
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Salon Members</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Use <span className="font-semibold text-neutral-700">Target page</span> on a row to open the map and operator
              console.
            </p>
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="flex flex-wrap gap-3">
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

              <label className="min-w-[150px] flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Path data
                </span>
                <select
                  value={pathEnrichmentFilter}
                  onChange={(e) => setPathEnrichmentFilter(e.target.value as "all" | "has_path")}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
                  title="Filter by supplemental path-based enrichment (merge_path_enrichment_into_markets). Not primary site_identity truth."
                >
                  <option value="all">All</option>
                  <option value="has_path">Has path enrichment</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Sort via column headers (↑ / ↓). Default Priority column: active presence &amp; anchors first, then
              highest upgraded score.
            </p>
          </div>

          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <ClusterInsightsSummaryCard
                title="Clusters"
                count={selectedZoneClusters.length}
                subtitle="Size-sorted · full list"
                open={clustersOpen}
                onToggle={() => setClustersOpen((o) => !o)}
              />
              <ClusterInsightsSummaryCard
                title="Hidden opportunity"
                count={hiddenOpportunityQualifyingCount}
                subtitle="Path gap · top 5 when open"
                open={hiddenOpportunityOpen}
                onToggle={() => setHiddenOpportunityOpen((o) => !o)}
              />
              <ClusterInsightsSummaryCard
                title="Hot clusters"
                count={hotClusters.length}
                subtitle="Presence-ranked · top 5"
                open={hotClustersOpen}
                onToggle={() => setHotClustersOpen((o) => !o)}
              />
              <ClusterInsightsSummaryCard
                title="Top targets"
                count={topTargets.length}
                subtitle="Ranked members · top 5"
                open={topTargetsOpen}
                onToggle={() => setTopTargetsOpen((o) => !o)}
              />
            </div>
          </div>

          {clustersOpen ? (
            <div className="border-b border-neutral-200 px-4 py-4">
              {selectedZoneClusters.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selectedZoneClusters.map((cluster) => {
                    const met = clusterMetricsById.get(cluster.cluster_id);
                    const mems = selectedZoneMembers.filter((m) => m.cluster_id === cluster.cluster_id);
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
                            {met?.is_hidden_opportunity ? (
                              <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                Hidden
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
                              <div className="mt-1 space-y-0.5 font-mono tabular-nums">
                                <div>
                                  Active: {met.active_member_count} / {met.total_member_count || cluster.member_count}
                                </div>
                                <div>
                                  Path: {met.path_enriched_member_count}
                                  {met.resolved_member_count > 0 ? ` · Resolved: ${met.resolved_member_count}` : ""} · Score:{" "}
                                  {met.cluster_opportunity_score}
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
                        {met ? (
                          <ClusterEvidencePanel members={mems} metrics={met} marketsUrlState={marketsUrlState} />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">No clusters detected for this zone.</p>
              )}
            </div>
          ) : null}

          {hiddenOpportunityOpen ? (
            <div className="border-b border-neutral-200 px-4 py-4">
              {hiddenOpportunityClusters.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {hiddenOpportunityClusters.map(({ cluster, metrics: met, mems }, index) => (
                    <article
                      key={cluster.cluster_id}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Hidden #{index + 1}
                        </div>
                        <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          Hidden
                        </span>
                      </div>
                      <div
                        className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-900"
                        title={clusterDisplayTitle(cluster, mems)}
                      >
                        {clusterDisplayTitle(cluster, mems)}
                      </div>
                      <div className="mt-1 font-mono text-[11px] tabular-nums text-neutral-700">
                        Active: {met.active_member_count} / {cluster.member_count}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-neutral-700">
                        Path: {met.path_enriched_member_count}
                        {met.resolved_member_count > 0 ? ` · Resolved: ${met.resolved_member_count}` : ""} · Score:{" "}
                        {met.cluster_opportunity_score}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-600">
                        IG {met.instagram_member_count} · Booking {met.booking_member_count}
                      </div>
                      <ClusterEvidencePanel members={mems} metrics={met} marketsUrlState={marketsUrlState} />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">
                  No clusters match hidden-opportunity rules (active &lt; 50% with ≥2 path-enriched members).
                </p>
              )}
            </div>
          ) : null}

          {hotClustersOpen ? (
            <div className="border-b border-neutral-200 px-4 py-4">
              {hotClusters.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                      <div className="mt-1 font-mono text-[11px] tabular-nums text-neutral-700">
                        Path: {met.path_enriched_member_count}
                        {met.resolved_member_count > 0 ? ` · Resolved: ${met.resolved_member_count}` : ""} · Opp score:{" "}
                        {met.cluster_opportunity_score}
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
                        {met.is_hidden_opportunity ? (
                          <span className="inline-flex rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Hidden
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
                      <ClusterEvidencePanel members={mems} metrics={met} marketsUrlState={marketsUrlState} />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">No clusters in this zone.</p>
              )}
            </div>
          ) : null}

          {topTargetsOpen ? (
            <div className="border-b border-neutral-200 px-4 py-4">
              {topTargets.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                        <span className="ml-1 inline-flex align-middle">
                          <PathEnrichmentBadge member={member} />
                        </span>
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
                      <div className="mt-2 min-h-[1.5rem] space-y-1">
                        <PresenceBadges member={member} />
                        <PathEnrichmentBadge member={member} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">No top targets available for this zone.</p>
              )}
            </div>
          ) : null}

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
                    <SortTh
                      column="presence"
                      label="Presence"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleColumnSort}
                      headerTitle="Primary: site_identity outbound links on crawled sites. Path badge (when shown) = supplemental corroboration only — not replacement truth."
                    />
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
                              title="Instagram or booking provider present (site_identity)"
                            >
                              Active
                            </span>
                          ) : null}
                          <PathEnrichmentBadge member={member} />
                          <GrayResolutionBadge member={member} />
                          <Link
                            href={buildSalesTargetPath(member.location_id, marketsUrlState)}
                            className="inline-flex shrink-0 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-neutral-800"
                            title="Open sales target map and operator console for this business"
                          >
                            Target page
                          </Link>
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
                      <td
                        className="max-w-[14rem] px-4 py-3"
                        title={
                          member.path_enrichment_matched || member.gray_resolution_matched
                            ? "Presence = site_identity. Path / Resolved badges = supplemental (not primary truth)."
                            : "Presence = site_identity outbound links"
                        }
                      >
                        <div className="flex flex-col gap-1">
                          <PresenceBadges member={member} />
                          <div className="flex flex-wrap items-center gap-1">
                            <PathEnrichmentBadge member={member} />
                            <GrayResolutionBadge member={member} />
                          </div>
                          {member.path_enrichment_matched ? (
                            <span className="text-[10px] leading-snug text-neutral-400">
                              Path = supplemental corroboration
                            </span>
                          ) : null}
                          {member.gray_resolution_matched ? (
                            <span className="text-[10px] leading-snug text-neutral-400">
                              Resolved = gray-pin supplemental
                            </span>
                          ) : null}
                        </div>
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
