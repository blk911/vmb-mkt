"use client";

import type { Dispatch, SetStateAction } from "react";
import { TARGET_ZONES } from "@/lib/geo/target-zones";
import type { UnknownResolverFiltersState } from "@/lib/unknown-resolver/resolver-types";

type Props = {
  filters: UnknownResolverFiltersState;
  setFilters: Dispatch<SetStateAction<UnknownResolverFiltersState>>;
  cityOptions: string[];
  ringOptions: string[];
};

export default function UnknownResolverFilters({ filters, setFilters, cityOptions, ringOptions }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Category
          <select
            value={filters.category}
            disabled
            className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-xs text-neutral-700"
          >
            <option value="house_cleaning">house_cleaning</option>
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Ring
          <select
            value={filters.ring}
            onChange={(e) => setFilters((f) => ({ ...f, ring: e.target.value }))}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {ringOptions.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All rings" : `${r} mi`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          City
          <select
            value={filters.city}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Target zone
          <select
            value={filters.zoneId}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                zoneId: e.target.value as UnknownResolverFiltersState["zoneId"],
              }))
            }
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All zones</option>
            {TARGET_ZONES.filter((z) => z.active).map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          System rec.
          <select
            value={filters.systemRecommendation}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                systemRecommendation: e.target.value as UnknownResolverFiltersState["systemRecommendation"],
              }))
            }
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="review">Review</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Operator
          <select
            value={filters.operatorDecision}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                operatorDecision: e.target.value as UnknownResolverFiltersState["operatorDecision"],
              }))
            }
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="undecided">Undecided</option>
            <option value="yes">Yes</option>
            <option value="review">Review</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Min score
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minScore}
            onChange={(e) => setFilters((f) => ({ ...f, minScore: Number(e.target.value) || 0 }))}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="block min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Search
          <input
            type="search"
            value={filters.searchText}
            onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))}
            placeholder="Name, address, city…"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={filters.onlyUndecided}
            onChange={(e) => setFilters((f) => ({ ...f, onlyUndecided: e.target.checked }))}
            className="rounded border-neutral-400"
          />
          Only undecided
        </label>
      </div>

      <div className="mt-3 grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Outreach status
          <select
            value={filters.outreachStatus}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                outreachStatus: e.target.value as UnknownResolverFiltersState["outreachStatus"],
              }))
            }
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="none">None</option>
            <option value="new">New</option>
            <option value="researching">Researching</option>
            <option value="ready">Ready</option>
            <option value="attempted">Attempted</option>
            <option value="awaiting_response">Awaiting response</option>
            <option value="follow_up_due">Follow-up due</option>
            <option value="interested">Interested</option>
            <option value="not_now">Not now</option>
            <option value="closed_won">Closed won</option>
            <option value="ignored">Ignored</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs text-neutral-800">
          <input
            type="checkbox"
            checked={filters.promotedOnly}
            onChange={(e) => setFilters((f) => ({ ...f, promotedOnly: e.target.checked }))}
            className="rounded border-neutral-400"
          />
          Promoted only
        </label>
        <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs text-neutral-800">
          <input
            type="checkbox"
            checked={filters.operatorYesOnly}
            onChange={(e) => setFilters((f) => ({ ...f, operatorYesOnly: e.target.checked }))}
            className="rounded border-neutral-400"
          />
          Operator yes only
        </label>
      </div>
    </div>
  );
}
