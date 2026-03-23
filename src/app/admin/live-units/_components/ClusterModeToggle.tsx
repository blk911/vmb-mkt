"use client";

export type LiveUnitsViewMode = "rows" | "clusters";

type Props = {
  mode: LiveUnitsViewMode;
  onChange: (mode: LiveUnitsViewMode) => void;
  className?: string;
};

/** Rows vs Clusters — additive to Review / Work mode; does not reset filters. */
export default function ClusterModeToggle({ mode, onChange, className = "" }: Props) {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm ${className}`}
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange("rows")}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === "rows" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Rows
      </button>
      <button
        type="button"
        onClick={() => onChange("clusters")}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          mode === "clusters" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Clusters
      </button>
    </div>
  );
}
