"use client";

import type { WorkResolutionState, WorkResolutionSuggestedAction } from "@/lib/live-units/work-mode-resolution";

type Props = {
  resolution: WorkResolutionState;
  onAction: (action: WorkResolutionSuggestedAction) => void;
};

/**
 * Inline guidance when Work Mode is empty or filter-constrained.
 * Parent should only mount when resolution.showResolutionStrip is true.
 */
export default function WorkModeResolutionStrip({ resolution, onAction }: Props) {
  const { suggestedActions, explanation, blockedByLine, savedFiltersNote, recommendedPresetLabel } = resolution;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
      <p className="font-medium leading-snug">{explanation}</p>

      {blockedByLine ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-900/95">
          <span className="font-semibold">Blocked by: </span>
          {blockedByLine}.
        </p>
      ) : null}

      {savedFiltersNote ? <p className="mt-2 text-[11px] text-amber-900/90">{savedFiltersNote}</p> : null}

      {recommendedPresetLabel ? (
        <p className="mt-2 text-[11px] font-medium text-amber-900">
          Recommended next preset: <span className="text-amber-950">{recommendedPresetLabel}</span>
        </p>
      ) : null}

      {suggestedActions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAction(a)}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/80"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
