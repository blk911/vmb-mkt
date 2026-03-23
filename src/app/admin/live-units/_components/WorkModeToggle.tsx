"use client";

import type { LiveUnitsMode } from "@/lib/live-units/work-mode-types";

type Props = {
  mode: LiveUnitsMode;
  onChange: (mode: LiveUnitsMode) => void;
};

export default function WorkModeToggle({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 shadow-sm"
      role="group"
      aria-label="Live Units view mode"
    >
      <button
        type="button"
        onClick={() => onChange("review")}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === "review"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-pressed={mode === "review"}
      >
        Review Mode
      </button>
      <button
        type="button"
        onClick={() => onChange("work")}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === "work"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-pressed={mode === "work"}
      >
        Work Mode
      </button>
    </div>
  );
}
