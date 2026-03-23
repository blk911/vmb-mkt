"use client";

import type { LiveUnitsLoadTrace } from "@/lib/live-units/live-units-debug-types";
import {
  basenameFromPath,
  explainEmptyDataset,
  formatAttemptsSummary,
} from "@/lib/live-units/live-units-debug-logic";

type Props = {
  trace: LiveUnitsLoadTrace;
  /** Rows in client after hydration (same as attachPlatformSignals input length). */
  hydratedRowCount: number;
  /** Rows after current UI filters (display set). */
  visibleRowCount: number;
};

/**
 * Server load trace + client visibility. Shown when diagnostics needed (zero data or base source).
 */
export default function LiveUnitsDebugStrip({ trace, hydratedRowCount, visibleRowCount }: Props) {
  const showExpanded =
    trace.rowsSentToClient === 0 || hydratedRowCount === 0 || visibleRowCount === 0 || trace.droppedMalformed > 0;
  const emptyExplain = explainEmptyDataset(trace);

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs leading-snug ${
        trace.rowsSentToClient === 0
          ? "border-amber-200 bg-amber-50/90 text-amber-950"
          : "border-slate-200 bg-slate-50/90 text-slate-800"
      }`}
    >
      <div className="font-semibold text-slate-900">Data load trace</div>
      <div className="mt-1 font-mono text-[11px] text-slate-700">
        <span className="text-slate-500">CWD:</span> {trace.cwd}
      </div>
      <div className="mt-1 text-[11px] text-slate-700">
        <span className="font-medium text-slate-800">Chosen:</span> {trace.chosenSource ?? "—"} ·{" "}
        <span className="break-all">{trace.chosenPath ? basenameFromPath(trace.chosenPath) : "—"}</span>
      </div>
      <div className="mt-2 grid gap-0.5 font-mono text-[11px] text-slate-800 sm:grid-cols-2">
        <div>
          <span className="text-slate-500">① Raw loaded:</span> {trace.rowsLoadedRaw}
        </div>
        <div>
          <span className="text-slate-500">② Parsed:</span> {trace.rowsAfterParse}
        </div>
        <div>
          <span className="text-slate-500">③ After required-field gates:</span> {trace.rowsAfterRequiredFieldGates}
        </div>
        <div>
          <span className="text-slate-500">④ Sent to UI:</span> {trace.rowsSentToClient}
        </div>
        <div>
          <span className="text-slate-500">Hydrated in client:</span> {hydratedRowCount}
        </div>
        <div>
          <span className="text-slate-500">Visible (filters):</span> {visibleRowCount}
        </div>
        {trace.droppedMalformed > 0 ? (
          <div className="sm:col-span-2 text-amber-900">
            <span className="text-slate-500">Dropped malformed:</span> {trace.droppedMalformed}
          </div>
        ) : null}
      </div>

      {showExpanded ? (
        <div className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Attempts: </span>
            {formatAttemptsSummary(trace)}
          </div>
          {emptyExplain ? <p className="mt-1.5 text-slate-800">{emptyExplain}</p> : null}
          {trace.rowsSentToClient > 0 && visibleRowCount === 0 ? (
            <p className="mt-1.5 text-slate-700">
              Rows loaded on the server, but <strong>no rows match the current UI filters</strong> (confidence, review,
              zone, etc.). Reset filters or clear ZIP.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
