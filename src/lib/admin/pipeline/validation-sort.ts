import type { ValidationReviewRow } from "./types";

export type ValidationSortColumn = "candidate" | "lanes" | "status" | "confidence";
export type ValidationSort = { column: ValidationSortColumn; direction: "asc" | "desc" };
export type ValidationSearchParams = Record<string, string | string[] | undefined>;

const columns: readonly string[] = ["candidate", "lanes", "status", "confidence"];
const textOrder = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function parseValidationSort(params: ValidationSearchParams): ValidationSort | null {
  if (typeof params.sort !== "string" || !columns.includes(params.sort)) return null;
  if (params.direction !== undefined && params.direction !== "asc" && params.direction !== "desc") return null;
  return { column: params.sort as ValidationSortColumn, direction: params.direction || "asc" };
}

export function validationSortHref(params: ValidationSearchParams, column?: ValidationSortColumn): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "sort" || key === "direction" || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
  }
  if (column) {
    const current = parseValidationSort(params);
    query.set("sort", column);
    query.set("direction", current?.column === column && current.direction === "asc" ? "desc" : "asc");
  }
  const suffix = query.toString();
  return `/admin/validate${suffix ? `?${suffix}` : ""}`;
}

function confidenceValue(row: ValidationReviewRow): number | null {
  if (typeof row.confidenceScore === "number" && Number.isFinite(row.confidenceScore)) return row.confidenceScore;
  const label = row.confidence.trim().toLowerCase();
  // Match the queue's existing confidence scale, including mixed numeric labels.
  if (label === "low") return 50;
  if (label === "medium") return 70;
  if (label === "high") return 90;
  const value = label ? Number(label) : NaN;
  return Number.isFinite(value) ? value : null;
}

function sortValue(row: ValidationReviewRow, column: ValidationSortColumn): string | number | null {
  if (column === "confidence") return confidenceValue(row);
  if (column === "candidate") return row.displayName.trim() || null;
  const lanes = [...row.lanes].sort();
  if (column === "lanes") return lanes.join(" · ") || null;
  return lanes.map((lane) => `${lane}: ${row.laneStatuses[lane] || "pending"}`).join(" · ") || null;
}

export function sortValidationReviewRows(rows: readonly ValidationReviewRow[], sort: ValidationSort | null): ValidationReviewRow[] {
  // Without a column sort, retain the queue loader's newest-first order exactly.
  if (!sort) return [...rows];
  return [...rows].sort((left, right) => {
    const a = sortValue(left, sort.column);
    const b = sortValue(right, sort.column);
    // Unknown values stay last in either direction.
    if (a === null && b !== null) return 1;
    if (a !== null && b === null) return -1;
    const compared = a === null || b === null ? 0 : typeof a === "number" && typeof b === "number"
      ? a - b
      : textOrder.compare(String(a), String(b));
    if (compared) return sort.direction === "asc" ? compared : -compared;
    const newestFirst = (right.createdAt || "").localeCompare(left.createdAt || "");
    if (newestFirst) return newestFirst;
    return left.reviewKey < right.reviewKey ? -1 : left.reviewKey > right.reviewKey ? 1 : 0;
  });
}
