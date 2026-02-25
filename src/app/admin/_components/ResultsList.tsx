"use client";

import React from "react";
import type { AdminQueryState, AdminCategory } from "../_lib/adminQueryState";
import { applyFilters, applySort } from "../_lib/adminQueryState";
import TargetPicker from "./TargetPicker";

function filterByCategory<T extends Record<string, any>>(
  rows: T[],
  category: AdminCategory,
  node?: { kind: string; id: string }
): T[] {
  let filtered = rows.filter((row) => {
    const segment = String(row.segment || "").toLowerCase();
    
    switch (category) {
      case "corp_owned":
        return segment === "corp_owned" || segment.includes("corp");
      case "corp_franchise":
        return segment === "corp_franchise" || segment.includes("franchise");
      case "indie":
        return segment === "indie" || !segment || segment === "single_shop";
      case "solo_at_salon":
        // Tech rows that match facility addressId
        return row.kind === "tech" && row.addressId && row.facilityId;
      case "solo_at_solo":
        // Tech rows that don't match facility
        return row.kind === "tech" && !row.facilityId;
      default:
        return true;
    }
  });

  // PATCH 2B: Apply franchise brand filter if node is selected
  if (category === "corp_franchise" && node?.kind === "franchise_brand") {
    filtered = filtered.filter((row) => row.franchiseBrandId === node.id);
  }

  return filtered;
}

function filterByNode<T extends Record<string, any>>(
  rows: T[],
  node: { kind: string; id: string },
  category: AdminCategory
): T[] {
  return rows.filter((row) => {
    switch (node.kind) {
      case "corp":
        return String(row.corpOwnerId || row.corpId || "") === node.id;
      case "brand":
      case "franchise_brand":
        // PATCH 2B: franchise_brand filtering is handled in filterByCategory
        return String(row.franchiseBrandId || row.franchisorBrandId || row.brandId || "") === node.id;
      case "facility":
        return String(row.facilityId || row.id || "") === node.id;
      case "address":
        return String(row.addressId || row.addressKey || "") === node.id;
      case "franchisee":
        return String(row.franchiseeId || "") === node.id;
      case "owner":
        return String(row.ownerId || "") === node.id;
      case "bucket":
        // Bucket nodes are category-specific groupings
        return true; // Will be handled by category filter
      default:
        return true;
    }
  });
}

type ResultsListProps = {
  state: AdminQueryState;
  activeId: string | null;
  pinnedId: string | null;
  onActiveChange: (id: string | null, facility?: ResultRow | null) => void;
  onPinChange: (id: string | null, facility?: ResultRow | null) => void;
  onResultCountChange?: (count: number) => void;
};

type ResultRow = {
  id: string;
  name: string;
  city?: string;
  zip?: string;
  sizeBand?: string;
  techCount?: number;
  renewSoon?: boolean;
  [key: string]: any;
};

export default function ResultsList({
  state,
  activeId,
  pinnedId,
  onActiveChange,
  onPinChange,
  onResultCountChange,
}: ResultsListProps) {
  const [rows, setRows] = React.useState<ResultRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showMore, setShowMore] = React.useState(false);
  const MAX_VISIBLE = 100;

  // Fetch data based on state
  // Step 3: Fix caching keys - include category in deps
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const isSoloCategory =
          state.category === "solo_at_salon" || state.category === "solo_at_solo";

        const params = new URLSearchParams();
        if (state.search) params.set("q", state.search);
        if (state.geo?.state) params.set("state", state.geo.state);
        if (state.geo?.city) params.set("city", state.geo.city);
        if (state.geo?.zip) params.set("zip", state.geo.zip);
        params.set("page", "1");
        params.set("pageSize", "1000");

        const endpoint = isSoloCategory
          ? `/api/admin/dora/truth/tech/index?${params.toString()}`
          : `/api/admin/dora/truth/facilities/index?category=${state.category}&${params.toString()}`;

        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`API ${res.status}: ${t.slice(0, 120)}`);
        }

        const j = await res.json();
        if (!alive) return;

        if (!j.ok) {
          throw new Error(j.error || "Failed to load data");
        }

        // Transform to ResultRow format based on category
        const transformed: ResultRow[] = (j.rows || []).map((r: any) => {
          const row = isSoloCategory
            ? {
                id: r.techId || r.licenseNumber || String(Math.random()),
                name: r.name || r.licenseNumber || "Unknown",
                city: r.addresses?.[0]?.city || "",
                zip: r.addresses?.[0]?.zip5 || "",
                sizeBand: r.sizeBand,
                techCount: 1,
                renewSoon: false,
                kind: "tech",
                segment: r.segment || "solo",
                addressId: r.addresses?.[0]?.addressKey || r.homeRollupKey || null,
                facilityId: Number(r.salonCount || 0) > 0 ? (r.primaryRollupKey || "salon") : null,
                ...r,
              }
            : {
                id: r.addressKey || r.rollupKey || String(Math.random()),
                name: r.businessName || r.name || r.addressKey || r.rollupKey || "Unknown",
                city: r.city,
                zip: r.zip5 || r.zip,
                sizeBand: r.sizeBand,
                techCount: r.attachedTechCount ?? r.techCount ?? 0,
                renewSoon: false, // TODO: implement
                kind: "facility",
                segment: r.segment,
                // STEP 3: Ensure facility rows have addressId
                addressId: r.addressId || r.addressKey || r.rollupKey || null,
                ...r,
              };

          // STEP 3: Defensive assertion (TEMP)
          if (!row.addressId && state.category !== "solo_at_salon" && state.category !== "solo_at_solo") {
            console.warn("FACILITY MISSING addressId", row.id, row.name);
          }

          return row;
        });

        setRows(transformed);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Fetch error");
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [state.category, state.node?.id]); // Step 3: category in deps

  const filtered = React.useMemo(() => {
    let result = rows;

    // Step 2: Filter by category first (includes franchise brand filtering)
    result = filterByCategory(result, state.category, state.node);

    // Step 4: Apply additional node filters if selected (for non-franchise nodes)
    if (state.node && state.node.kind !== "franchise_brand") {
      result = filterByNode(result, state.node, state.category);
    }

    // Then apply other filters and sort
    result = applyFilters(result, state);
    result = applySort(result, state);

    return result;
  }, [rows, state.category, state.node, state]);

  const visibleRows = showMore ? filtered : filtered.slice(0, MAX_VISIBLE);
  const hasMore = filtered.length > MAX_VISIBLE;

  // Step 5: Report count to parent for debug readout
  React.useEffect(() => {
    if (onResultCountChange) {
      onResultCountChange(filtered.length);
    }
  }, [filtered.length, onResultCountChange]);

  if (loading) {
    return (
      <div className="p-6 text-center opacity-70">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 font-semibold">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 text-sm opacity-70">
        Showing {visibleRows.length} of {filtered.length} results
      </div>

      <div className="space-y-2">
        {visibleRows.map((row) => (
          <ResultCard
            key={row.id}
            row={row}
            isActive={activeId === row.id}
            isPinned={pinnedId === row.id}
            onMouseEnter={() => onActiveChange(row.id, row)}
            onMouseLeave={() => {
              if (pinnedId !== row.id) onActiveChange(null, null);
            }}
            onClick={() => {
              if (pinnedId === row.id) {
                onPinChange(null, null);
              } else {
                onPinChange(row.id, row);
                onActiveChange(row.id, row);
              }
            }}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowMore(!showMore)}
            className="px-4 py-2 border border-neutral-200 rounded-lg font-bold hover:bg-neutral-50"
          >
            {showMore ? "Show Less" : `Show More (${filtered.length - MAX_VISIBLE} more)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  row,
  isActive,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  row: ResultRow;
  isActive: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`p-4 border rounded-xl cursor-pointer transition-colors ${
        isActive || isPinned
          ? "border-black bg-neutral-50"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-bold text-lg">{row.name}</div>
          <div className="text-sm opacity-70 mt-1">
            {row.city && <span>{row.city}</span>}
            {row.city && row.zip && <span>, </span>}
            {row.zip && <span>{row.zip}</span>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            {row.sizeBand && (
              <span className="opacity-70">Size: {row.sizeBand}</span>
            )}
            {row.techCount !== undefined && (
              <span className="opacity-70">Tech: {row.techCount}</span>
            )}
            {row.renewSoon && (
              <span className="text-orange-600 font-semibold">Renew Soon</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPinned && <span className="text-xs opacity-70">📌</span>}
          <TargetPicker item={row} />
        </div>
      </div>
    </div>
  );
}
