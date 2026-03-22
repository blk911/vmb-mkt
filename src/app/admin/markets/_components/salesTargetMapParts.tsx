"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { PresenceBadges } from "@/components/admin/PresenceBadges";
import { buildMemberDetailPath, type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import {
  type NearbyProspectRow,
  SALES_TARGET_RINGS,
  memberHasValidCoords,
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

/** Browser bundle must read NEXT_PUBLIC_* directly; do not gate on `process` (undefined in some client bundles). */
export function readBrowserMapsKey(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export type SalesMapCanvasProps = {
  origin: EnrichedBeautyZoneMember;
  nearbyRows: NearbyProspectRow[];
  /** Taller map on dedicated target page */
  size?: "default" | "large";
};

export function SalesMapCanvas({ origin, nearbyRows, size = "default" }: SalesMapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const apiKey = readBrowserMapsKey();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const nearbyKey = useMemo(
    () => nearbyRows.map((r) => r.member.location_id).join("|"),
    [nearbyRows]
  );

  const minH = size === "large" ? "min-h-[min(52vh,560px)]" : "min-h-[360px]";
  const minFallback = size === "large" ? "min-h-[400px]" : "min-h-[320px]";

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
    const windowDefined = typeof window !== "undefined";
    const keyRaw = readBrowserMapsKey();
    const keyLen = keyRaw.length;
    const keyPrefix = keyLen >= 6 ? keyRaw.slice(0, 6) : "";
    const debugLine = `Map debug: client=${mounted ? "yes" : "no"}, window=${windowDefined ? "yes" : "no"}, keyPresent=no, keyLength=${keyLen}, keyPrefix=${keyPrefix || "(none)"}`;
    return (
      <div
        className={`flex ${minFallback} flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-900`}
      >
        <p className="font-semibold">Map needs a browser key</p>
        <p className="mt-1 text-xs text-amber-800">
          Set <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>. The nearby list still
          works.
        </p>
        <p className="mt-3 max-w-full break-all font-mono text-[10px] leading-snug text-amber-950/90">{debugLine}</p>
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

  const keyRawForDebug = readBrowserMapsKey();
  const keyLenOk = keyRawForDebug.length;
  const keyPrefixOk = keyLenOk >= 6 ? keyRawForDebug.slice(0, 6) : "";
  const windowOk = typeof window !== "undefined";
  const debugOk = `Map debug: client=${mounted ? "yes" : "no"}, window=${windowOk ? "yes" : "no"}, keyPresent=yes, keyLength=${keyLenOk}, keyPrefix=${keyPrefixOk || "(none)"}`;

  return (
    <div className="space-y-1">
      <div ref={elRef} className={`${minH} w-full rounded-xl border border-neutral-200 bg-neutral-100`} />
      <p className="max-w-full break-all font-mono text-[10px] leading-snug text-neutral-500" aria-hidden>
        {debugOk}
      </p>
    </div>
  );
}

export function prospectRowEmphasis(score: number): string {
  if (score >= 8) return "border-l-2 border-emerald-500/80 bg-emerald-50/60 pl-1.5";
  if (score >= 5) return "border-l border-sky-300/90 bg-sky-50/50 pl-1";
  return "pl-0.5";
}

export function ProspectRow({
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

export function NearbyProspectSection({
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
