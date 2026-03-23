import type {
  EnrichedResolverRow,
  ResolverRecommendation,
  UnknownResolverFiltersState,
} from "./resolver-types";
import { normalizeBusinessName } from "./resolver-normalize";

export const DEFAULT_UNKNOWN_RESOLVER_FILTERS: UnknownResolverFiltersState = {
  category: "nails",
  ring: "all",
  city: "all",
  systemRecommendation: "all",
  operatorDecision: "all",
  minScore: 0,
  searchText: "",
  onlyUndecided: false,
  outreachStatus: "all",
  promotedOnly: false,
  operatorYesOnly: false,
  zoneId: "all",
};

function recRank(r: ResolverRecommendation): number {
  switch (r) {
    case "review":
      return 2;
    case "yes":
      return 1;
    case "no":
      return 0;
    default:
      return 0;
  }
}

function matchesSearch(row: EnrichedResolverRow, raw: string): boolean {
  const q = normalizeBusinessName(raw) || raw.toLowerCase().trim();
  if (!q) return true;
  const hay = [
    row.record.sourceName,
    row.record.normalizedName,
    row.record.address,
    row.record.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q) || hay.includes(raw.trim().toLowerCase());
}

export function applyUnknownResolverFilters(
  rows: EnrichedResolverRow[],
  filters: UnknownResolverFiltersState
): EnrichedResolverRow[] {
  return rows.filter((row) => {
    if (filters.category !== "all" && row.record.category !== filters.category) return false;

    if (filters.ring !== "all") {
      const want = Number(filters.ring);
      if (row.record.ring == null || Number(row.record.ring) !== want) return false;
    }

    if (filters.city !== "all") {
      const c = (row.record.city ?? "").trim().toLowerCase();
      if (c !== filters.city.trim().toLowerCase()) return false;
    }

    if (filters.systemRecommendation !== "all") {
      if (row.score.recommendation !== filters.systemRecommendation) return false;
    }

    if (filters.operatorDecision !== "all") {
      if (filters.operatorDecision === "undecided") {
        if (row.record.operatorDecision != null) return false;
      } else if (row.record.operatorDecision !== filters.operatorDecision) {
        return false;
      }
    }

    if (row.score.finalScore < filters.minScore) return false;

    if (filters.onlyUndecided && row.record.operatorDecision != null) return false;

    if (filters.outreachStatus !== "all" && row.record.outreachStatus !== filters.outreachStatus) return false;

    if (filters.promotedOnly && row.record.promotedAt == null) return false;

    if (filters.operatorYesOnly && row.record.operatorDecision !== "yes") return false;

    if (!matchesSearch(row, filters.searchText)) return false;

    if (filters.zoneId !== "all") {
      if (!row.record.zones.includes(filters.zoneId)) return false;
    }

    return true;
  });
}

export function sortUnknownResolverQueue(rows: EnrichedResolverRow[]): EnrichedResolverRow[] {
  return [...rows].sort((a, b) => {
    const ua = a.record.operatorDecision == null ? 0 : 1;
    const ub = b.record.operatorDecision == null ? 0 : 1;
    if (ua !== ub) return ua - ub;

    if (b.score.finalScore !== a.score.finalScore) {
      return b.score.finalScore - a.score.finalScore;
    }

    const ra = recRank(a.score.recommendation);
    const rb = recRank(b.score.recommendation);
    if (rb !== ra) return rb - ra;

    return a.record.id.localeCompare(b.record.id);
  });
}
