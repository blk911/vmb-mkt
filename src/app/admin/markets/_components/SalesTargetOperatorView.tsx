"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { PresenceBadges } from "@/components/admin/PresenceBadges";
import {
  buildMarketsListPath,
  buildSalesTargetPath,
  type MarketsUrlState,
} from "@/app/admin/markets/_lib/marketsUrlState";
import {
  computeActiveRankScore,
  memberHasActivePresence,
} from "@/app/admin/markets/_lib/marketsActiveRank";
import {
  deriveNearbyProspectFlags,
  type NearbyProspectRow,
  type RingRollup,
  SALES_TARGET_RINGS,
  type SalesRingMiles,
  sortNearbyProspectsByRank,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import { SelectedProspectSummaryPanel } from "./SelectedProspectSummaryPanel";
import { NearbyProspectSection, SalesMapCanvas, type SalesMapCanvasHandle } from "./salesTargetMapParts";

function hiddenOppCount(rows: NearbyProspectRow[], maxMiles: number): number {
  return rows.filter((r) => r.distance_miles <= maxMiles && r.is_hidden_cluster).length;
}

function formatProspectListText(origin: EnrichedBeautyZoneMember, ringMiles: SalesRingMiles, rows: NearbyProspectRow[]): string {
  const inRing = rows.filter((r) => r.distance_miles <= ringMiles);
  const sorted = sortNearbyProspectsByRank([...inRing]);
  const lines = sorted.map(
    (r) =>
      `${r.member.name}\t${r.distance_miles.toFixed(2)} mi\tscore ${r.nearby_prospect_score}\tout ${r.outreach_score}\t${r.member.category}/${r.member.subtype}`
  );
  return [`Origin: ${origin.name} (${origin.location_id})`, `Ring: ≤${ringMiles} mi`, `Count: ${sorted.length}`, "", ...lines].join("\n");
}

function formatOutreachSummary(
  origin: EnrichedBeautyZoneMember,
  ringMiles: SalesRingMiles,
  inRing: NearbyProspectRow[]
): string {
  const sorted = sortNearbyProspectsByRank([...inRing]);
  const top = sorted.slice(0, 5);
  const topLines = top.map(
    (r) => `- ${r.member.name} (${r.distance_miles.toFixed(2)} mi, score ${r.nearby_prospect_score}, outreach ${r.outreach_score})`
  );
  return [
    `Sales target: ${origin.name}`,
    `Address: ${[origin.address, origin.city, origin.state, origin.zip].filter(Boolean).join(", ")}`,
    `Priority ${origin.upgraded_priority_score} · Outreach rank ${computeActiveRankScore(origin)}`,
    `Ring: ≤${ringMiles} mi · ${inRing.length} prospects in ring`,
    top.length ? `Top prospects:\n${topLines.join("\n")}` : "No prospects in this ring.",
  ].join("\n");
}

export type SalesTargetOperatorViewProps = {
  origin: EnrichedBeautyZoneMember;
  nearbyRows: NearbyProspectRow[];
  ringRollups: { r25: RingRollup; r5: RingRollup; r1: RingRollup };
  marketsUrlState: MarketsUrlState;
  initialRing: SalesRingMiles;
};

export function SalesTargetOperatorView({
  origin,
  nearbyRows,
  ringRollups,
  marketsUrlState,
  initialRing,
}: SalesTargetOperatorViewProps) {
  const router = useRouter();
  const mapRef = useRef<SalesMapCanvasHandle>(null);
  const [ringMiles, setRingMiles] = useState<SalesRingMiles>(initialRing);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const [sidebarHoverProspectId, setSidebarHoverProspectId] = useState<string | null>(null);
  const [flashProspectId, setFlashProspectId] = useState<string | null>(null);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [summaryPanelVisible, setSummaryPanelVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const backHref = buildMarketsListPath(marketsUrlState);

  const syncRingToUrl = useCallback(
    (r: SalesRingMiles) => {
      const path = buildSalesTargetPath(origin.location_id, marketsUrlState, r);
      router.replace(path, { scroll: false });
    },
    [origin.location_id, marketsUrlState, router]
  );

  const onRing = useCallback(
    (r: SalesRingMiles) => {
      setRingMiles(r);
      syncRingToUrl(r);
    },
    [syncRingToUrl]
  );

  const inRing = useMemo(
    () => nearbyRows.filter((row) => row.distance_miles <= ringMiles),
    [nearbyRows, ringMiles]
  );

  const anchors = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.member.is_anchor)),
    [inRing]
  );
  const activeOnly = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.active && !r.member.is_anchor)),
    [inRing]
  );
  const hiddenOpp = useMemo(
    () => sortNearbyProspectsByRank(inRing.filter((r) => r.is_hidden_cluster)),
    [inRing]
  );

  const originFlags = useMemo(() => deriveNearbyProspectFlags(origin), [origin]);

  const flash = useCallback((label: string) => {
    setCopyFlash(label);
    window.setTimeout(() => setCopyFlash(null), 2000);
  }, []);

  const mapHighlightId = selectedProspectId ?? sidebarHoverProspectId;

  const selectedProspectRow = useMemo(() => {
    if (!selectedProspectId) return null;
    return nearbyRows.find((r) => r.member.location_id === selectedProspectId) ?? null;
  }, [nearbyRows, selectedProspectId]);

  const selectProspect = useCallback((locationId: string, opts?: { panMap?: boolean }) => {
    setSelectedProspectId(locationId);
    setSummaryPanelVisible(true);
    setSummaryExpanded(false);
    setFlashProspectId(locationId);
    window.setTimeout(() => setFlashProspectId(null), 2200);
    if (opts?.panMap !== false) mapRef.current?.focusProspect(locationId);
    const el = document.getElementById(`vmb-prospect-${locationId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const onProspectSelectFromMap = useCallback(
    (locationId: string) => selectProspect(locationId, { panMap: false }),
    [selectProspect]
  );

  const onSidebarRowActivate = useCallback(
    (locationId: string) => selectProspect(locationId, { panMap: true }),
    [selectProspect]
  );

  const copyList = useCallback(async () => {
    const text = formatProspectListText(origin, ringMiles, nearbyRows);
    try {
      await navigator.clipboard.writeText(text);
      flash("list");
    } catch {
      flash("err");
    }
  }, [origin, ringMiles, nearbyRows, flash]);

  const copySummary = useCallback(async () => {
    const text = formatOutreachSummary(origin, ringMiles, inRing);
    try {
      await navigator.clipboard.writeText(text);
      flash("summary");
    } catch {
      flash("err");
    }
  }, [origin, ringMiles, inRing, flash]);

  const ringTable = [
    { label: "≤0.25 mi", miles: 0.25 as const, rollup: ringRollups.r25 },
    { label: "≤0.5 mi", miles: 0.5 as const, rollup: ringRollups.r5 },
    { label: "≤1 mi", miles: 1.0 as const, rollup: ringRollups.r1 },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Sales target</h1>
          <p className="text-xs text-neutral-500">Operator console · zone prospects only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={backHref}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            ← Back to Markets
          </Link>
          <button
            type="button"
            onClick={copyList}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Copy prospect list
          </button>
          <button
            type="button"
            onClick={copySummary}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Copy outreach summary
          </button>
        </div>
      </div>
      {copyFlash === "list" ? (
        <p className="text-xs font-medium text-emerald-700">Copied prospect list.</p>
      ) : null}
      {copyFlash === "summary" ? (
        <p className="text-xs font-medium text-emerald-700">Copied outreach summary.</p>
      ) : null}
      {copyFlash === "err" ? <p className="text-xs font-medium text-red-600">Clipboard unavailable.</p> : null}

      {/* A — Origin */}
      <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Origin</div>
        <div className="mt-1 text-lg font-semibold text-neutral-900">{origin.name}</div>
        <div className="mt-1 text-sm text-neutral-700">{[origin.address, origin.city, origin.state, origin.zip].filter(Boolean).join(", ")}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="text-neutral-600">
            {origin.category} · {origin.subtype}
          </span>
          {origin.is_anchor ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Anchor</span>
          ) : (
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">Not anchor</span>
          )}
          {memberHasActivePresence(origin) ? (
            <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Active</span>
          ) : (
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Not active</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PresenceBadges member={origin} />
          <PathEnrichmentBadge member={origin} />
        </div>
        <div className="mt-3 grid gap-1 text-xs text-neutral-700 sm:grid-cols-2">
          <div>
            <span className="font-semibold text-neutral-800">Outreach / signals: </span>
            {originFlags.member_has_direct_outreach ? "Direct outreach signals (phone / link hub)" : "No direct outreach signals flagged"}
          </div>
          <div>
            <span className="font-semibold text-neutral-800">Scores: </span>
            Priority {origin.upgraded_priority_score} · Outreach rank {computeActiveRankScore(origin)}
          </div>
        </div>
      </section>

      {/* B — Opportunity summary */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Opportunity by ring</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Anchors / active / hidden-opportunity counts (nearby prospects, same zone)</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-2">Ring</th>
                <th className="py-2 pr-2">Anchors</th>
                <th className="py-2 pr-2">Active</th>
                <th className="py-2 pr-2">Hidden opp</th>
                <th className="py-2">Prospects (≤ ring)</th>
              </tr>
            </thead>
            <tbody className="text-neutral-800">
              {ringTable.map((row) => {
                const total = nearbyRows.filter((r) => r.distance_miles <= row.miles).length;
                const hid = hiddenOppCount(nearbyRows, row.miles);
                return (
                  <tr key={row.label} className="border-b border-neutral-100">
                    <td className="py-2 pr-2 font-medium">{row.label}</td>
                    <td className="py-2 pr-2 tabular-nums">{row.rollup.anchors}</td>
                    <td className="py-2 pr-2 tabular-nums">{row.rollup.active}</td>
                    <td className="py-2 pr-2 tabular-nums">{hid}</td>
                    <td className="py-2 tabular-nums">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          <span className="font-semibold text-neutral-900">Current list radius ({ringMiles} mi): </span>
          {inRing.length} reachable prospects
          {inRing.length === 0 ? " — widen the ring or pick another origin." : ""}
        </div>
      </section>

      {/* Ring controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-neutral-500">List radius:</span>
        {SALES_TARGET_RINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRing(r)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              ringMiles === r ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
            }`}
          >
            {r} mi
          </button>
        ))}
      </div>

      {/* C + D — Map + prospects */}
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          <SalesMapCanvas
            ref={mapRef}
            origin={origin}
            nearbyRows={nearbyRows}
            size="large"
            interactive
            marketsUrlState={marketsUrlState}
            highlightProspectId={mapHighlightId}
            onProspectSelectFromMap={onProspectSelectFromMap}
          />
          {selectedProspectId && selectedProspectRow ? (
            <SelectedProspectSummaryPanel
              row={selectedProspectRow}
              visible={summaryPanelVisible}
              expanded={summaryExpanded}
              onToggleExpanded={() => setSummaryExpanded((e) => !e)}
              onClose={() => setSummaryPanelVisible(false)}
              onOpen={() => setSummaryPanelVisible(true)}
              marketsUrlState={marketsUrlState}
            />
          ) : null}
        </div>
        <aside className="w-full shrink-0 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 xl:w-[22rem]">
          <div className="text-xs font-semibold text-neutral-800">
            Nearby (≤{ringMiles} mi) · {inRing.length} prospects
          </div>
          <div className="mt-2 space-y-1 text-[10px] text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> 0.25 mi
            <span className="mx-1 inline-block h-2 w-2 rounded-full bg-yellow-600" /> 0.5 mi
            <span className="mx-1 inline-block h-2 w-2 rounded-full bg-red-600" /> 1.0 mi
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
            Pins: gold anchor · green active · blue path · violet resolved · gray low signal · large blue = origin
          </p>
          <div className="mt-3 max-h-[min(70vh,560px)] overflow-y-auto pr-1">
            <NearbyProspectSection
              title="Anchors nearby"
              rows={anchors}
              marketsUrlState={marketsUrlState}
              interactive
              hoveredSidebarProspectId={sidebarHoverProspectId}
              flashProspectId={flashProspectId}
              selectedProspectId={selectedProspectId}
              onSidebarHover={setSidebarHoverProspectId}
              onSidebarRowActivate={onSidebarRowActivate}
            />
            <NearbyProspectSection
              title="Active nearby"
              rows={activeOnly}
              marketsUrlState={marketsUrlState}
              interactive
              hoveredSidebarProspectId={sidebarHoverProspectId}
              flashProspectId={flashProspectId}
              selectedProspectId={selectedProspectId}
              onSidebarHover={setSidebarHoverProspectId}
              onSidebarRowActivate={onSidebarRowActivate}
            />
            <NearbyProspectSection
              title="Hidden-opportunity nearby"
              rows={hiddenOpp}
              marketsUrlState={marketsUrlState}
              interactive
              hoveredSidebarProspectId={sidebarHoverProspectId}
              flashProspectId={flashProspectId}
              selectedProspectId={selectedProspectId}
              onSidebarHover={setSidebarHoverProspectId}
              onSidebarRowActivate={onSidebarRowActivate}
            />
            {!anchors.length && !activeOnly.length && !hiddenOpp.length ? (
              <p className="text-xs text-neutral-500">No prospects in this ring with these groupings.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
