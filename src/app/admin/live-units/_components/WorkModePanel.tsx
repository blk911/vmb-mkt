"use client";

import type { WorkPresetId } from "@/lib/live-units/work-mode-types";
import { getWorkPresetMeta, zoneEmphasisForPreset, type WorkSummaryCounts } from "@/lib/live-units/work-mode-logic";
import WorkPresetChips from "./WorkPresetChips";

type Props = {
  summary: WorkSummaryCounts;
  activePresetId: WorkPresetId | null;
  onSelectPreset: (id: WorkPresetId) => void;
  usePresetOnly: boolean;
  onUsePresetOnlyChange: (value: boolean) => void;
};

export default function WorkModePanel({ summary, activePresetId, onSelectPreset, usePresetOnly, onUsePresetOnlyChange }: Props) {
  const meta = activePresetId ? getWorkPresetMeta(activePresetId) : null;
  const zoneLine = activePresetId ? zoneEmphasisForPreset(activePresetId) : null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Work Mode</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Top nail targets based on zone, score, and review state. Preset views focus the queue into operator-ready target sets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
          <span className="rounded-md border border-violet-200 bg-white px-2 py-1">High: {summary.highPriority}</span>
          <span className="rounded-md border border-emerald-200 bg-white px-2 py-1">Ready: {summary.readyToWork}</span>
          <span className="rounded-md border border-amber-200 bg-white px-2 py-1">Review: {summary.needsReview}</span>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1">Active zone: {summary.inActiveZone}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-sky-100 bg-white/70 px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Work scope</span>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50">
            <input
              type="radio"
              name="work-scope"
              checked={usePresetOnly}
              onChange={() => onUsePresetOnlyChange(true)}
            />
            Preset only
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50">
            <input
              type="radio"
              name="work-scope"
              checked={!usePresetOnly}
              onChange={() => onUsePresetOnlyChange(false)}
            />
            Preset + saved review filters
          </label>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Presets</div>
        <WorkPresetChips activeId={activePresetId} onSelect={onSelectPreset} />
      </div>

      {meta ? (
        <div className="mt-3 rounded-lg border border-sky-100 bg-white/80 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">{meta.label}</span>
          <span className="text-slate-500"> — {meta.shortHint}</span>
        </div>
      ) : null}

      {zoneLine ? (
        <p className="mt-2 text-[11px] font-medium text-slate-600">
          Working zone: <span className="text-slate-900">{zoneLine}</span>
        </p>
      ) : null}
    </div>
  );
}
