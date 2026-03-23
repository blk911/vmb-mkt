"use client";

import type { ClusterBuildDebug, FallbackAnchorHint } from "@/lib/live-units/cluster-mode-types";
import type { ClusterEmptyState } from "@/lib/live-units/cluster-debug-logic";
import { formatClusterDebugLine } from "@/lib/live-units/cluster-debug-logic";

function FallbackAnchorCard({ hint }: { hint: FallbackAnchorHint }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Potential anchor (not grouped)</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{hint.name}</div>
      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
        <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-800">{hint.liveLabel}</span>
        <span className="rounded bg-white px-1.5 py-0.5">{hint.entityKind.replaceAll("_", " ")}</span>
        <span className="tabular-nums text-slate-500">
          Score {hint.anchorScore} · {hint.scoreBandLabel}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
        <span className="font-medium text-slate-700">Signals:</span> {hint.reasonSummary}
      </p>
    </div>
  );
}

type Props = {
  debug: ClusterBuildDebug;
  emptyState: ClusterEmptyState;
  onFocusUnit?: (unitId: string) => void;
};

/**
 * Compact operator debug for Cluster Mode — counts, explanations, fallback hints.
 */
export default function ClusterModeDebugStrip({ debug, emptyState, onFocusUnit }: Props) {
  const showZeroClusterExplainer =
    debug.clustersFormed === 0 &&
    emptyState.case !== "none" &&
    emptyState.case !== "C_anchors_no_related";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-sm">
      <div className="text-[11px] font-medium text-slate-600">{formatClusterDebugLine(debug)}</div>

      {emptyState.case === "C_anchors_no_related" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          <span className="font-semibold">Grouping note: </span>
          {emptyState.message}
          {emptyState.detail ? <span className="mt-1 block text-amber-900/85">{emptyState.detail}</span> : null}
        </div>
      ) : null}

      {showZeroClusterExplainer ? (
        <div className="space-y-1.5 rounded-md border border-slate-100 bg-slate-50/90 px-2.5 py-2 text-[11px] leading-snug text-slate-800">
          <p>{emptyState.message}</p>
          {emptyState.detail ? <p className="text-slate-600">{emptyState.detail}</p> : null}
        </div>
      ) : null}

      {emptyState.showFallbackAnchors && debug.fallbackAnchors.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Top anchor-scored rows (did not clear anchor bar)</div>
          <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
            {debug.fallbackAnchors.map((h) => (
              <button
                key={h.unitId}
                type="button"
                onClick={() => onFocusUnit?.(h.unitId)}
                className="text-left transition hover:opacity-90"
                disabled={!onFocusUnit}
              >
                <FallbackAnchorCard hint={h} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
