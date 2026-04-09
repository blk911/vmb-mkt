"use client";

import { useState } from "react";
import type { SourceIntakeDriftEvent } from "@/lib/source-intake/phase2-types";

type DriftSummaryCardProps = {
  event: SourceIntakeDriftEvent | null;
  onCompute?: () => void;
  busy?: boolean;
};

export function DriftSummaryCard({ event, onCompute, busy }: DriftSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Drift Events</h3>
          <p className="text-sm text-neutral-600">Roster drift compares this processed intake to the previous comparable snapshot for the same facility or source label.</p>
        </div>
        {onCompute ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCompute}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
          >
            {busy ? "Computing..." : "Recompute Drift"}
          </button>
        ) : null}
      </div>

      {event ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Added</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{event.summary.added}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Removed</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{event.summary.removed}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Role Changes</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{event.summary.roleChanged}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Price Changes</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{event.summary.priceChanged}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Name Changes</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{event.summary.nameChanged}</div>
            </div>
          </div>

          <div className="text-sm text-neutral-700">
            Baseline: <span className="font-medium text-neutral-900">{event.baselineIntakeId}</span>
            {"  "}Comparison: <span className="font-medium text-neutral-900">{event.comparisonIntakeId}</span>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="text-sm font-medium text-neutral-800 underline"
          >
            {expanded ? "Hide Details" : "Show Details"}
          </button>

          {expanded ? (
            <div className="space-y-2 text-sm">
              {event.changes.map((change, index) => (
                <div key={`${change.type}-${index}`} className="rounded-xl bg-neutral-50 px-3 py-2">
                  <div className="font-medium text-neutral-900">{change.type}</div>
                  <div className="text-neutral-700">
                    {change.baselineDisplayName || "n/a"} -> {change.comparisonDisplayName || "n/a"}
                  </div>
                  <div className="text-xs text-neutral-500">{change.reasons.join(" | ")}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No comparable prior processed intake or no detected roster drift yet.</p>
      )}
    </section>
  );
}
