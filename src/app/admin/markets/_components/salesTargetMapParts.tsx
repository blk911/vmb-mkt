"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { GrayResolutionBadge } from "@/components/admin/GrayResolution";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { PresenceBadges } from "@/components/admin/PresenceBadges";
import { type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import {
  type NearbyProspectRow,
  type ProspectMarkerKind,
  SALES_TARGET_RINGS,
  classifyProspect,
  memberHasValidCoords,
  prospectTypeLabel,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";

/** Ring visuals: inner ring strongest, outer lightest */
const RING_STYLES = [
  { stroke: "#15803d", strokeOpacity: 0.95, strokeWeight: 2.5, fillOpacity: 0.08 },
  { stroke: "#ca8a04", strokeOpacity: 0.82, strokeWeight: 2, fillOpacity: 0.055 },
  { stroke: "#f87171", strokeOpacity: 0.62, strokeWeight: 1.5, fillOpacity: 0.035 },
] as const;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type { ProspectMarkerKind };
export { classifyProspect, prospectTypeLabel as typeLabel };
const typeLabel = prospectTypeLabel;

function opacityForDistance(miles: number): number {
  if (miles <= 0.25) return 1;
  if (miles <= 0.5) return 0.92;
  return 0.84;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prospectSymbol(g: any, kind: ProspectMarkerKind, opts: { emphasized?: boolean }): any {
  const path = g.SymbolPath.CIRCLE;
  const emphasized = !!opts.emphasized;
  const scale = emphasized ? 9.5 : 7;
  const strokeWeight = kind === "path" || kind === "resolved" ? 2.5 : 2;
  switch (kind) {
    case "anchor":
      return {
        path,
        scale: emphasized ? scale * 1.15 : scale,
        fillColor: "#ca8a04",
        fillOpacity: 1,
        strokeColor: "#fef3c7",
        strokeWeight,
      };
    case "active":
      return {
        path,
        scale: emphasized ? scale * 1.15 : scale,
        fillColor: "#16a34a",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight,
      };
    case "path":
      return {
        path,
        scale: emphasized ? scale * 1.15 : scale,
        fillColor: "#bfdbfe",
        fillOpacity: 1,
        strokeColor: "#2563eb",
        strokeWeight,
      };
    case "resolved":
      return {
        path,
        scale: emphasized ? scale * 1.12 : scale,
        fillColor: "#ede9fe",
        fillOpacity: 1,
        strokeColor: "#7c3aed",
        strokeWeight,
      };
    default:
      return {
        path,
        scale: emphasized ? scale * 1.1 : scale,
        fillColor: "#d1d5db",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
      };
  }
}

export type SalesMapCanvasHandle = {
  focusProspect: (locationId: string) => void;
};

export type SalesMapCanvasProps = {
  origin: EnrichedBeautyZoneMember;
  nearbyRows: NearbyProspectRow[];
  /** Taller map on dedicated target page */
  size?: "default" | "large";
  /** Semantic markers, tooltips, sidebar sync (target page). */
  interactive?: boolean;
  marketsUrlState: MarketsUrlState;
  /** Sidebar hover → emphasize marker */
  highlightProspectId?: string | null;
  /** After marker click, parent scrolls list */
  onProspectSelectFromMap?: (locationId: string) => void;
};

export const SalesMapCanvas = forwardRef<SalesMapCanvasHandle, SalesMapCanvasProps>(function SalesMapCanvas(
  {
    origin,
    nearbyRows,
    size = "default",
    interactive = false,
    marketsUrlState: _marketsUrlState,
    highlightProspectId = null,
    onProspectSelectFromMap,
  },
  ref
) {
  void _marketsUrlState;
  const elRef = useRef<HTMLDivElement>(null);
  const apiKey = readBrowserMapsKey();

  const nearbyKey = useMemo(
    () => nearbyRows.map((r) => r.member.location_id).join("|"),
    [nearbyRows]
  );

  const rowById = useMemo(() => {
    const m = new Map<string, NearbyProspectRow>();
    for (const row of nearbyRows) m.set(row.member.location_id, row);
    return m;
  }, [nearbyRows]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersByIdRef = useRef<Map<string, any>>(new Map());
  const prospectKindsRef = useRef<Map<string, ProspectMarkerKind>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverInfoRef = useRef<any>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);

  const minH = size === "large" ? "min-h-[min(52vh,560px)]" : "min-h-[360px]";
  const minFallback = size === "large" ? "min-h-[400px]" : "min-h-[320px]";

  /** Pan/zoom to prospect marker; closes hover. No detail InfoWindow (inline summary panel is primary). */
  const panToProspectOnly = useCallback((locationId: string) => {
    const map = mapRef.current;
    const marker = markersByIdRef.current.get(locationId);
    if (!map || !marker) return;
    hoverInfoRef.current?.close();
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    map.panTo(marker.getPosition());
    const z = map.getZoom();
    if (z != null && z < 15) map.setZoom(15);
  }, []);

  const panToProspectRef = useRef(panToProspectOnly);
  panToProspectRef.current = panToProspectOnly;
  const onSelectRef = useRef(onProspectSelectFromMap);
  onSelectRef.current = onProspectSelectFromMap;

  useImperativeHandle(
    ref,
    () => ({
      focusProspect: (locationId: string) => {
        panToProspectRef.current(locationId);
      },
    }),
    []
  );

  useEffect(() => {
    if (!interactive) return;
    const g = gRef.current;
    if (!g) return;
    const id = highlightProspectId;
    markersByIdRef.current.forEach((marker, locId) => {
      const kind = prospectKindsRef.current.get(locId) ?? "fallback";
      const emphasized = id != null && locId === id;
      marker.setIcon(prospectSymbol(g, kind, { emphasized }));
      marker.setZIndex(emphasized ? 800 : 100);
    });
  }, [interactive, highlightProspectId, mapReady]);

  useEffect(() => {
    if (!apiKey || !memberHasValidCoords(origin) || !elRef.current) return;
    let cancelled = false;
    let disposeOverlays: (() => void) | undefined;

    loadGoogleMapsScript(apiKey).then(() => {
      if (cancelled || !elRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google?.maps;
      if (!g) return;
      gRef.current = g;

      const container = elRef.current;
      container.innerHTML = "";
      const center = { lat: origin.lat, lng: origin.lon };
      const map = new g.Map(container, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
      mapRef.current = map;

      markersByIdRef.current = new Map();
      prospectKindsRef.current = new Map();

      const overlays: Array<{ setMap: (x: null) => void }> = [];

      SALES_TARGET_RINGS.forEach((mi, i) => {
        const st = RING_STYLES[i] ?? RING_STYLES[RING_STYLES.length - 1];
        const circle = new g.Circle({
          map,
          center,
          radius: mi * 1609.344,
          strokeColor: st.stroke,
          strokeOpacity: st.strokeOpacity,
          strokeWeight: st.strokeWeight,
          fillColor: st.stroke,
          fillOpacity: st.fillOpacity,
        });
        overlays.push(circle);
      });

      if (interactive) {
        const halo = new g.Circle({
          map,
          center,
          radius: 45,
          strokeColor: "#4285F4",
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: "#4285F4",
          fillOpacity: 0.06,
          zIndex: 0,
        });
        overlays.push(halo);
      }

      const originIcon = {
        path: g.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      };

      const originMarker = new g.Marker({
        map,
        position: center,
        title: origin.name,
        zIndex: 2000,
        icon: originIcon,
      });
      originMarkerRef.current = originMarker;
      overlays.push(originMarker);

      hoverInfoRef.current = new g.InfoWindow({ disableAutoPan: true });

      const tooltipHtml = (row: NearbyProspectRow) => {
        const kind = classifyProspect(row);
        const resolvedHint =
          kind === "resolved"
            ? `<div style="color:#6d28d9;font-size:10px;margin-top:4px;line-height:1.3">Gray resolution (supplemental hint — not primary presence)</div>`
            : "";
        return `<div style="font-family:system-ui,sans-serif;padding:6px 8px;font-size:12px;max-width:220px">
          <div style="font-weight:600">${escapeHtml(row.member.name)}</div>
          <div style="color:#555;margin-top:2px">${row.distance_miles.toFixed(2)} mi</div>
          <div style="color:#666;font-size:11px;margin-top:2px">${escapeHtml(typeLabel(kind))}</div>
          ${resolvedHint}
        </div>`;
      };

      for (const row of nearbyRows) {
        const m = row.member;
        if (!memberHasValidCoords(m)) continue;
        const kind = classifyProspect(row);
        prospectKindsRef.current.set(m.location_id, kind);
        const pos = { lat: m.lat, lng: m.lon };
        const marker = new g.Marker({
          map,
          position: pos,
          zIndex: 100,
          opacity: opacityForDistance(row.distance_miles),
          icon: prospectSymbol(g, kind, { emphasized: false }),
        });
        markersByIdRef.current.set(m.location_id, marker);

        if (interactive) {
          marker.addListener("mouseover", () => {
            if (hoverCloseTimerRef.current) {
              clearTimeout(hoverCloseTimerRef.current);
              hoverCloseTimerRef.current = null;
            }
            hoverInfoRef.current.setContent(tooltipHtml(row));
            hoverInfoRef.current.open({ map, anchor: marker });
          });
          marker.addListener("mouseout", () => {
            hoverCloseTimerRef.current = setTimeout(() => {
              hoverInfoRef.current?.close();
            }, 200);
          });
          marker.addListener("click", () => {
            if (hoverCloseTimerRef.current) {
              clearTimeout(hoverCloseTimerRef.current);
              hoverCloseTimerRef.current = null;
            }
            hoverInfoRef.current?.close();
            panToProspectRef.current(m.location_id);
            onSelectRef.current?.(m.location_id);
          });
        }
      }

      const bounds = new g.LatLngBounds();
      bounds.extend(center);
      for (const row of nearbyRows) {
        const m = row.member;
        if (memberHasValidCoords(m)) bounds.extend({ lat: m.lat, lng: m.lon });
      }
      map.fitBounds(bounds, 56);

      if (!cancelled) setMapReady(true);

      disposeOverlays = () => {
        setMapReady(false);
        hoverInfoRef.current?.close();
        overlays.forEach((o) => o.setMap(null));
        markersByIdRef.current.clear();
        prospectKindsRef.current.clear();
        originMarkerRef.current = null;
        mapRef.current = null;
        hoverInfoRef.current = null;
        gRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      disposeOverlays?.();
      if (elRef.current) elRef.current.innerHTML = "";
    };
  }, [apiKey, origin.location_id, origin.lat, origin.lon, nearbyKey, interactive]);

  if (!apiKey) {
    return (
      <div
        className={`flex ${minFallback} flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center text-sm text-amber-900`}
      >
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

  return (
    <div ref={elRef} className={`${minH} w-full rounded-xl border border-neutral-200 bg-neutral-100`} />
  );
});

export function prospectRowEmphasis(score: number): string {
  if (score >= 8) return "border-l-2 border-emerald-500/80 bg-emerald-50/60 pl-1.5";
  if (score >= 5) return "border-l border-sky-300/90 bg-sky-50/50 pl-1";
  return "pl-0.5";
}

export type ProspectRowProps = {
  row: NearbyProspectRow;
  marketsUrlState: MarketsUrlState;
  /** Target page: hover/click sync with map */
  interactive?: boolean;
  highlightFlash?: boolean;
  isSidebarHovered?: boolean;
  /** Selected for map/list/panel sync */
  isSelected?: boolean;
  onRowPointerEnter?: () => void;
  onRowPointerLeave?: () => void;
  onRowActivate?: () => void;
};

export function ProspectRow({
  row,
  marketsUrlState,
  interactive = false,
  highlightFlash = false,
  isSidebarHovered = false,
  isSelected = false,
  onRowPointerEnter,
  onRowPointerLeave,
  onRowActivate,
}: ProspectRowProps) {
  const m = row.member;
  const rowDomId = `vmb-prospect-${m.location_id}`;
  const ring = highlightFlash ? "ring-2 ring-sky-500 ring-offset-1 bg-sky-50/70" : "";
  const selectedRing =
    isSelected && !highlightFlash ? "ring-2 ring-violet-400 ring-offset-1 bg-violet-50/50" : "";
  const hoverBg = isSidebarHovered && !highlightFlash && !isSelected ? "bg-neutral-100/90" : "";

  return (
    <div
      id={rowDomId}
      className={`border-b border-neutral-100 py-1.5 last:border-0 ${prospectRowEmphasis(row.nearby_prospect_score)} ${ring} ${selectedRing} ${hoverBg} transition-colors ${
        interactive ? "cursor-pointer rounded px-0.5" : ""
      }`}
      onMouseEnter={interactive ? onRowPointerEnter : undefined}
      onMouseLeave={interactive ? onRowPointerLeave : undefined}
      onClick={interactive ? onRowActivate : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowActivate?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Link
          href={buildMemberDetailPath(m.location_id, marketsUrlState)}
          className="min-w-0 max-w-[11rem] truncate text-xs font-semibold text-sky-700 hover:underline sm:max-w-none"
          onClick={(e) => e.stopPropagation()}
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
        <GrayResolutionBadge member={m} />
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

export type NearbyProspectSectionProps = {
  title: string;
  rows: NearbyProspectRow[];
  marketsUrlState: MarketsUrlState;
  interactive?: boolean;
  flashProspectId?: string | null;
  hoveredSidebarProspectId?: string | null;
  selectedProspectId?: string | null;
  onSidebarHover?: (locationId: string | null) => void;
  onSidebarRowActivate?: (locationId: string) => void;
};

export function NearbyProspectSection({
  title,
  rows,
  marketsUrlState,
  interactive = false,
  flashProspectId,
  hoveredSidebarProspectId,
  selectedProspectId,
  onSidebarHover,
  onSidebarRowActivate,
}: NearbyProspectSectionProps) {
  if (!rows.length) return null;
  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-100 bg-white/80">
        {rows.map((row) => {
          const id = row.member.location_id;
          return (
            <ProspectRow
              key={id}
              row={row}
              marketsUrlState={marketsUrlState}
              interactive={interactive}
              highlightFlash={flashProspectId === id}
              isSidebarHovered={hoveredSidebarProspectId === id}
              isSelected={selectedProspectId === id}
              onRowPointerEnter={interactive ? () => onSidebarHover?.(id) : undefined}
              onRowPointerLeave={interactive ? () => onSidebarHover?.(null) : undefined}
              onRowActivate={interactive ? () => onSidebarRowActivate?.(id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
