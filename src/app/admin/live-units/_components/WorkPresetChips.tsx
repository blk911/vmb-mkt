"use client";

import type { WorkPresetId } from "@/lib/live-units/work-mode-types";
import { WORK_PRESETS } from "@/lib/live-units/work-mode-types";

type Props = {
  activeId: WorkPresetId | null;
  onSelect: (id: WorkPresetId) => void;
};

export default function WorkPresetChips({ activeId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {WORK_PRESETS.map((p) => {
        const on = activeId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              on
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
