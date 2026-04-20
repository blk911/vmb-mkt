import { listCanonicalOperators } from "@/lib/admin/operator-adapter";
import type { TargetRow } from "./types";

export type TargetFilters = {
  city?: string;
  category?: string;
  ig?: string;
  confidence?: string;
};

export async function listTargetRows(): Promise<TargetRow[]> {
  const rows = await listCanonicalOperators();
  return rows.map((row) => ({
    operatorId: row.id,
    name: row.name,
    city: row.city,
    category: row.category || "unknown",
    instagram: row.ig,
    hasInstagram: Boolean(row.ig),
    confidenceScore: row.score,
    status: row.status,
  }));
}

export function filterTargetRows(rows: TargetRow[], filters: TargetFilters): TargetRow[] {
  const minConfidence = Number(filters.confidence || 0);
  return rows.filter((row) => {
    if (filters.city && filters.city !== "all" && row.city !== filters.city) return false;
    if (filters.category && filters.category !== "all" && row.category !== filters.category) return false;
    if (filters.ig === "with" && !row.hasInstagram) return false;
    if (filters.ig === "without" && row.hasInstagram) return false;
    if (minConfidence > 0 && row.confidenceScore < minConfidence) return false;
    return true;
  });
}

export function getTargetFilterOptions(rows: TargetRow[]) {
  const cities = [...new Set(rows.map((row) => row.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return { cities, categories };
}
