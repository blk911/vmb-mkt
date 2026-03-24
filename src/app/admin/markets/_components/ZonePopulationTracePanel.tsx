"use client";

import { normalizeZoneId } from "@/lib/geo/target-zones";
import type { ZonePopulationTrace } from "@/lib/markets/zone-population-trace-types";

function traceMatchesZone(trace: ZonePopulationTrace, marketZoneId: string): boolean {
  const c = normalizeZoneId(marketZoneId);
  return normalizeZoneId(trace.zoneId) === c || normalizeZoneId(trace.zoneCanonicalId) === c;
}

function TraceTable({ traces, highlightCanonicalId }: { traces: ZonePopulationTrace[]; highlightCanonicalId?: string }) {
  return (
    <div className="overflow-x-auto text-[11px]">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="py-1.5 pr-2">Zone</th>
            <th className="py-1.5 pr-2 tabular-nums" title="A — Live Units rows in zone">
              LU rows
            </th>
            <th className="py-1.5 pr-2 tabular-nums" title="B — raw ≥70">
              HC ≥70
            </th>
            <th className="py-1.5 pr-2 tabular-nums" title="C — Expansion 60–69">
              Exp
            </th>
            <th className="py-1.5 pr-2 tabular-nums" title="D — Markets members">
              Mkt
            </th>
            <th className="py-1.5 pr-2 tabular-nums" title="E — approved file">
              Appr
            </th>
            <th className="py-1.5 pr-2 tabular-nums" title="F — anchors">
              Anch
            </th>
            <th className="py-1.5 tabular-nums" title="F — clusters">
              Clu
            </th>
          </tr>
        </thead>
        <tbody>
          {traces.map((t) => (
            <tr
              key={t.zoneCanonicalId}
              className={`border-b border-neutral-100 last:border-0 ${
                highlightCanonicalId && t.zoneCanonicalId === highlightCanonicalId ? "bg-sky-50" : ""
              }`}
            >
              <td className="py-1.5 pr-2 font-medium text-neutral-900">{t.zoneLabel}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.liveUnitsDatasetCount}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.liveUnitsHighConfidenceCount}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.liveUnitsExpansionCount}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.marketsMemberCount}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.operationalApprovedCount}</td>
              <td className="py-1.5 pr-2 tabular-nums text-neutral-800">{t.anchorCount}</td>
              <td className="py-1.5 tabular-nums text-neutral-800">{t.clusterCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-snug text-neutral-500">
        HC = high-confidence band (raw ≥70). Exp = Expansion (60–69). Mkt = enriched members JSON. Appr = approved live
        units tied to zone. Anch/Clu = same rollup as zone work packet (ops summary).
      </p>
    </div>
  );
}

type Props = {
  traces: ZonePopulationTrace[];
  /** Markets catalog `zone_id` (e.g. QC01) or ALL when no zone is selected. */
  selectedMarketZoneId: string;
};

/**
 * Compact admin diagnostics: where Quebec / Westminster / Lafayette population drops out (config vs Live Units vs Markets).
 * Hidden in normal flow unless expanded; when a trace zone is selected, shows that zone’s diagnosis inline.
 */
export default function ZonePopulationTracePanel({ traces, selectedMarketZoneId }: Props) {
  if (!traces.length) return null;

  const selectedTrace =
    selectedMarketZoneId !== "ALL"
      ? traces.find((t) => traceMatchesZone(t, selectedMarketZoneId))
      : undefined;

  return (
    <details className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80">
      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold text-neutral-700">
        Zone population trace (Quebec · Westminster · Lafayette)
      </summary>
      <div className="border-t border-neutral-200 px-3 pb-3 pt-1">
        {selectedTrace ? (
          <p className="mb-2 text-[11px] leading-snug text-neutral-800">
            <span className="font-semibold text-neutral-900">{selectedTrace.zoneLabel}:</span> {selectedTrace.diagnosis}
          </p>
        ) : (
          <p className="mb-2 text-[11px] text-neutral-600">
            Select a zone above to see a one-line diagnosis for that zone. Full checkpoint table:
          </p>
        )}
        <TraceTable traces={traces} highlightCanonicalId={selectedTrace?.zoneCanonicalId} />
      </div>
    </details>
  );
}
