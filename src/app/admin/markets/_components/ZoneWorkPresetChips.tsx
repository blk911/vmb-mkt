"use client";

import type { MarketsWorkPreset } from "@/lib/markets/zone-ops-types";

const PRESETS: Array<{ id: MarketsWorkPreset; label: string }> = [
  { id: "top_targets", label: "Top Targets" },
  { id: "anchors", label: "Anchors" },
  { id: "clusters", label: "Clusters" },
  { id: "bookable", label: "Bookable" },
  { id: "needs_review", label: "Needs Review" },
];

type Props = {
  activePreset: MarketsWorkPreset | null;
  onSelect: (preset: MarketsWorkPreset | null) => void;
};

export default function ZoneWorkPresetChips({ activePreset, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zone work presets">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
          activePreset === null
            ? "border-sky-500 bg-sky-50 text-sky-900"
            : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
        }`}
      >
        All
      </button>
      {PRESETS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(activePreset === id ? null : id)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
            activePreset === id
              ? "border-sky-500 bg-sky-50 text-sky-900"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
