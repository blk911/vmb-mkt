"use client";

import { useMemo, useState } from "react";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import type { StatusNorm } from "@/lib/vmb/status";

type Row = NonNullable<EnrichedBeautyZoneMember["nearby_dora_licenses_ranked"]>[number];

type SortCol = "composite" | "licenseType" | "licenseStatus" | "distance_miles";
type SortDir = "asc" | "desc";

const STATUS_TIER: Record<StatusNorm, number> = {
  ACTIVE: 0,
  EXPIRED: 1,
  INACTIVE: 2,
  UNKNOWN: 3,
};

/** DORA strings vary (e.g. "ACTIVE - WITH CONDITIONS"); tier by substring. */
function licenseStatusTier(raw: string): StatusNorm {
  const u = String(raw ?? "").trim().toUpperCase();
  if (!u) return "UNKNOWN";
  if (u.includes("EXPIRED")) return "EXPIRED";
  if (u.includes("INACTIVE") || u.includes("RETIRED") || u.includes("SUSPENDED")) return "INACTIVE";
  if (u.includes("ACTIVE") || u === "CURRENT") return "ACTIVE";
  return "UNKNOWN";
}

function compareStatus(a: string, b: string): number {
  return STATUS_TIER[licenseStatusTier(a)] - STATUS_TIER[licenseStatusTier(b)];
}

function isExpiredDisplay(raw: string): boolean {
  return String(raw ?? "").toUpperCase().includes("EXPIRED");
}

function compareComposite(a: Row, b: Row): number {
  const s = compareStatus(a.licenseStatus, b.licenseStatus);
  if (s !== 0) return s;
  if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
  return (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" });
}

type Props = {
  rows: Row[];
};

export default function LicenseHoldersTable({ rows }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("composite");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      if (sortCol === "composite") {
        return compareComposite(a, b);
      }
      if (sortCol === "licenseStatus") {
        const c = compareStatus(a.licenseStatus, b.licenseStatus);
        if (c !== 0) return c * dir;
        // Same status: keep distance ascending, then name (do not flip with status dir).
        if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
        return (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" });
      }
      if (sortCol === "licenseType") {
        const c = (a.licenseType || "").localeCompare(b.licenseType || "", undefined, { sensitivity: "base" });
        if (c !== 0) return c * dir;
        return compareComposite(a, b);
      }
      if (sortCol === "distance_miles") {
        const c = a.distance_miles - b.distance_miles;
        if (c !== 0) return c * dir;
        return compareComposite(a, b);
      }
      return 0;
    });

    return copy;
  }, [rows, sortCol, sortDir]);

  function onHeaderClick(col: Exclude<SortCol, "composite">) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "distance_miles" ? "asc" : "asc");
    }
  }

  function onDefaultClick() {
    setSortCol("composite");
    setSortDir("asc");
  }

  function sortHint(col: SortCol): string {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const thBtn =
    "inline-flex max-w-full items-center gap-1 text-left font-medium text-neutral-600 transition hover:text-neutral-900";

  return (
    <div className="mt-2 max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="sticky top-0 bg-neutral-50">
          <tr className="text-left text-neutral-600">
            <th className="px-3 py-2">
              <button
                type="button"
                className={thBtn}
                onClick={onDefaultClick}
                title="Reset to default: active licenses first, then closest by miles"
              >
                Name
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className={thBtn} onClick={() => onHeaderClick("licenseType")} title="Sort by license type">
                Type{sortHint("licenseType")}
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className={thBtn} onClick={() => onHeaderClick("licenseStatus")} title="Sort by status">
                Status{sortHint("licenseStatus")}
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className={thBtn} onClick={() => onHeaderClick("distance_miles")} title="Sort by miles">
                Mi{sortHint("distance_miles")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {sorted.map((row, i) => (
            <tr key={`${row.rowId || row.addressKey}-${i}`} className="text-neutral-800">
              <td className="px-3 py-2">{row.fullName || "—"}</td>
              <td className="px-3 py-2 text-xs">{row.licenseType || "—"}</td>
              <td className="px-3 py-2 text-xs">
                <span className={isExpiredDisplay(row.licenseStatus) ? "text-neutral-500" : "text-neutral-900"}>
                  {row.licenseStatus || "—"}
                </span>
              </td>
              <td className="px-3 py-2 font-mono tabular-nums">{row.distance_miles.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
