"use client";

import React from "react";
import type { AdminQueryState, SizeBand } from "../_lib/adminQueryState";

type TopFiltersBarProps = {
  state: AdminQueryState;
  onChange: (next: AdminQueryState) => void;
  onSaveView?: () => void;
};

export default function TopFiltersBar({ state, onChange, onSaveView }: TopFiltersBarProps) {
  const [search, setSearch] = React.useState(state.search || "");

  React.useEffect(() => {
    const t = setTimeout(() => {
      onChange({ ...state, search: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="flex-1 min-w-[200px] px-3 py-2 border border-neutral-200 rounded-lg"
      />

      {/* Geo Filters */}
      <input
        type="text"
        value={state.geo?.state || ""}
        onChange={(e) =>
          onChange({
            ...state,
            geo: { ...state.geo, state: e.target.value.trim() || undefined },
          })
        }
        placeholder="State"
        className="px-3 py-2 border border-neutral-200 rounded-lg w-24"
      />
      <input
        type="text"
        value={state.geo?.city || ""}
        onChange={(e) =>
          onChange({
            ...state,
            geo: { ...state.geo, city: e.target.value.trim() || undefined },
          })
        }
        placeholder="City"
        className="px-3 py-2 border border-neutral-200 rounded-lg w-32"
      />
      <input
        type="text"
        value={state.geo?.zip || ""}
        onChange={(e) =>
          onChange({
            ...state,
            geo: { ...state.geo, zip: e.target.value.trim() || undefined },
          })
        }
        placeholder="Zip"
        className="px-3 py-2 border border-neutral-200 rounded-lg w-24"
      />

      {/* Size Band */}
      <select
        value={state.sizeBand || ""}
        onChange={(e) =>
          onChange({
            ...state,
            sizeBand: (e.target.value || undefined) as SizeBand | undefined,
          })
        }
        className="px-3 py-2 border border-neutral-200 rounded-lg"
      >
        <option value="">All Sizes</option>
        <option value="0-6">0-6</option>
        <option value="6-15">6-15</option>
        <option value="15+">15+</option>
      </select>

      {/* Sort */}
      <select
        value={state.sort?.key || "name"}
        onChange={(e) =>
          onChange({
            ...state,
            sort: {
              key: e.target.value as any,
              dir: state.sort?.dir || "asc",
            },
          })
        }
        className="px-3 py-2 border border-neutral-200 rounded-lg"
      >
        <option value="name">Name</option>
        <option value="city">City</option>
        <option value="size">Size</option>
        <option value="techCount">Tech Count</option>
        <option value="renewSoon">Renew Soon</option>
      </select>
      <button
        onClick={() =>
          onChange({
            ...state,
            sort: {
              key: state.sort?.key || "name",
              dir: state.sort?.dir === "asc" ? "desc" : "asc",
            },
          })
        }
        className="px-3 py-2 border border-neutral-200 rounded-lg"
        title="Toggle sort direction"
      >
        {state.sort?.dir === "desc" ? "↓" : "↑"}
      </button>

      {onSaveView && (
        <button
          onClick={onSaveView}
          className="px-4 py-2 bg-black text-white rounded-lg font-bold hover:bg-neutral-800"
        >
          Save View as Target List
        </button>
      )}
    </div>
  );
}
