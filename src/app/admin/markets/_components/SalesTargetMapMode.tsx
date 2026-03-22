"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { PresenceBadges } from "@/components/admin/PresenceBadges";
import { buildMemberDetailPath, type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import {
  type NearbyProspectRow,
  type RingRollup,
  SALES_TARGET_RINGS,
  type SalesRingMiles,
  memberHasValidCoords,
  sortNearbyProspectsByRank,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";

const RING_COLORS = ["#16a34a", "#ca8a04", "#dc2626"] as const;

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google;
  if (g?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;
  mapsScriptPromise = new Promise((resolve, reject) => {
    const id = "google-maps-js-vmb-sales";
    if (document.getElementById(id)) {
      const t = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.maps) {
          clearInterval(t);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.maps) resolve();
        else reject(new Error("timeout"));
      }, 15000);
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(s);
  });
  return mapsScriptPromise;
}

type MapCanvasProps = {
  origin: EnrichedBeautyZoneMember;
  nearbyRows: NearbyProspectRow[];
};

function SalesMapCanvas({ origin, nearbyRows }: MapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const apiKey = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) || "";
  const nearbyKey = useMemo(
    () => nearbyRows.map((r) => r.member.location_id).join("|"),
    [nearbyRows]
  );

  useEffect(() => {
    if (!apiKey || !memberHasValidCoords(origin) || !elRef.current) return;
    let cancelled = false;
    let disposeOverlays: (() => void) | undefined;

    loadGoogleMapsScript(apiKey).then(() => {
      if (cancelled || !elRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google?.maps;
      if (!g) return;

      const container = elRef.current;
      container.innerHTML = "";
      const center = { lat: origin.lat, lng: origin.lon };
      const map = new g.Map(container, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      const overlays: Array<{ setMap: (x: null) => void }> = [];

      SALES_TARGET_RINGS.forEach((mi, i) => {
        const circle = new g.Circle({
          map,
          center,
          radius: mi * 1609.344,
          strokeColor: RING_COLORS[i],
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: RING_COLORS[i],
          fillOpacity: 0.04,
        });
        overlays.push(circle);
      });

      overlays.push(
        new g.Marker({
          map,
          position: center,
          title: origin.name,
          zIndex: 1000,
        })
      );

      for (const row of nearbyRows) {
        const m = row.member;
        if (!memberHasValidCoords(m)) continue;
        overlays.push(
          new g.Marker({
            map,
            position: { lat: m.lat, lng: m.lon },
            title: `${m.name} (${row.distance_miles.toFixed(2)} mi)`,
            opacity: 0.82,
          })
        );
      }

      const bounds = new g.LatLngBounds();
      bounds.extend(center);
      for (const row of nearbyRows) {
        const m = row.member;
        if (memberHasValidCoords(m)) bounds.extend({ lat: m.lat, lng: m.lon });
      }
      map.fitBounds(bounds, 56);

      disposeOverlays = () => {
        overlays.forEach((o) => o.setMap(null));
      };
    });

    return () => {
      cancelled = true;
      disposeOverlays?.();
      if (elRef.current) elRef.current.innerHTML = "";
    };
  }, [apiKey, origin.location_id, origin.lat, origin.lon, nearbyKey]);

  if (!apiKey) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-900">
        <p className="font-semibold">Map needs a browser key</p>
        <p className="mt-1 text-xs text-amber-800">
          Set <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>. The nearby list still
          works.
        </p>
      </div>
    );
  }

  if (!memberHasValidCoords(origin)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        Selected target has no valid lat/lon — pick another row.
      </div>
    );
  }

  return <div ref={elRef} className="min-h-[360px] w-full rounded-xl border border-neutral-200 bg-neutral-100" />;
}

function prospectRowEmphasis(score: number): string {
  if (score >= 8) return "border-l-2 border-emerald-500/80 bg-emerald-50/60 pl-1.5";
  if (score >= 5) return "border-l border-sky-300/90 bg-sky-50/50 pl-1";
  return "pl-0.5";
}

function ProspectRow({
  row,
  marketsUrlState,
}: {
  row: NearbyProspectRow;
  marketsUrlState: MarketsUrlState;
}) {
  const m = row.member;
  return (
    <div className={`border-b border-neutral-100 py-1.5 last:border-0 ${prospectRowEmphasis(row.nearby_prospect_score)}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Link
          href={buildMemberDetailPath(m.location_id, marketsUrlState)}
          className="min-w-0 max-w-[11rem] truncate text-xs font-semibold text-sky-700 hover:underline sm:max-w-none"
        >
          {m.name}
        </Link>
        <span
          className="shrink-0 rounded bg-neutral-800/90 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-white"
          title="Nearby prospect score (UI rank)"
        >
          Score {row.nearby_prospect_score}
        </span>
        <span className="text-[10px] tabular-nums text-neutral-500">{row.distance_miles.toFixed(2)} mi</span>
        {m.is_anchor ? (
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-900">Anchor</span>
        ) : null}
        {row.active ? (
          <span className="rounded bg-teal-100 px-1 py-0.5 text-[9px] font-semibold text-teal-900">Active</span>
        ) : null}
        <PathEnrichmentBadge member={m} />
      </div>
      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-neutral-600">
        <span>
          Pri {m.upgraded_priority_score} · Out {row.outreach_score}
          {row.cluster_opportunity_score != null ? ` · Clus opp ${row.cluster_opportunity_score}` : ""}
        </span>
        <span className="text-neutral-400">
          {m.category}/{m.subtype}
        </span>
      </div>
      <div className="mt-0.5">
        <PresenceBadges member={m} className="scale-90 origin-left" />
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  marketsUrlState,
}: {
  title: string;
  rows: NearbyProspectRow[];
  marketsUrlState: MarketsUrlState;
}) {
  if (!rows.length) return null;
  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-100 bg-white/80">
        {rows.map((row) => (
          <ProspectRow key={row.member.location_id} row={row} marketsUrlState={marketsUrlState} />
        ))}
      </div>
    </div>
  );
}

export type SalesTargetMapModeProps = {
  origin: EnrichedBeautyZoneMember | null;
  onClearOrigin: () => void;
  nearbyRows: NearbyProspectRow[];
  ringMiles: SalesRingMiles;
  onRingMiles: (r: SalesRingMiles) => void;
  ringRollups: { r25: RingRollup; r5: RingRollup; r1: RingRollup } | null;
  marketsUrlState: MarketsUrlState;
};

export function SalesTargetMapMode({
  origin,
  onClearOrigin,
  nearbyRows,
  ringMiles,
  onRingMiles,
  ringRollups,
  marketsUrlState,
}: SalesTargetMapModeProps) {
  const inRing = useMemo(
    () => nearbyRows.filter((r) => r.distance_miles <= ringMiles),
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

  return (
    <div className="border-b border-neutral-200 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Sales Target Map</h3>
          <p className="text-xs text-neutral-500">
            Ranked nearby lists (score + outreach + priority). Rings: zone coords only.
          </p>
        </div>
        {origin ? (
          <button
            type="button"
            onClick={onClearOrigin}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Clear origin
          </button>
        ) : null}
      </div>

      {!origin ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
          Select a business as origin: use <span className="font-semibold">Set origin</span> on a table row below.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Origin</div>
              <div className="mt-0.5 font-semibold text-neutral-900">{origin.name}</div>
              <div className="mt-1 text-xs text-neutral-600">{[origin.address, origin.city, origin.state, origin.zip].filter(Boolean).join(", ")}</div>
              <div className="mt-1 text-xs text-neutral-600">
                {origin.category} · {origin.subtype}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PresenceBadges member={origin} />
                <PathEnrichmentBadge member={origin} />
              </div>
              {ringRollups ? (
                <div className="mt-1.5 text-[9px] leading-snug text-neutral-600 opacity-90">
                  Rings: ≤0.25 A{ringRollups.r25.anchors}/Act{ringRollups.r25.active}/C{ringRollups.r25.distinct_clusters} · ≤0.5
                  A{ringRollups.r5.anchors}/Act{ringRollups.r5.active}/C{ringRollups.r5.distinct_clusters} · ≤1 A
                  {ringRollups.r1.anchors}/Act{ringRollups.r1.active}/C{ringRollups.r1.distinct_clusters}
                </div>
              ) : null}
            </div>

            <SalesMapCanvas origin={origin} nearbyRows={nearbyRows} />

            <div className="flex flex-wrap gap-2">
              <span className="self-center text-[11px] font-semibold text-neutral-500">List radius:</span>
              {SALES_TARGET_RINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRingMiles(r)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    ringMiles === r ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800"
                  }`}
                >
                  {r} mi
                </button>
              ))}
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 lg:w-[22rem]">
            <div className="text-xs font-semibold text-neutral-800">
              Nearby (≤{ringMiles} mi) · {inRing.length} prospects
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-neutral-500">
              <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> 0.25 mi
              <span className="mx-1 inline-block h-2 w-2 rounded-full bg-yellow-600" /> 0.5 mi
              <span className="mx-1 inline-block h-2 w-2 rounded-full bg-red-600" /> 1.0 mi
            </div>
            <div className="mt-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
              <Section title="Anchors nearby" rows={anchors} marketsUrlState={marketsUrlState} />
              <Section title="Active nearby" rows={activeOnly} marketsUrlState={marketsUrlState} />
              <Section title="Hidden-opportunity nearby" rows={hiddenOpp} marketsUrlState={marketsUrlState} />
              {!anchors.length && !activeOnly.length && !hiddenOpp.length ? (
                <p className="text-xs text-neutral-500">No prospects in this ring with these groupings.</p>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
