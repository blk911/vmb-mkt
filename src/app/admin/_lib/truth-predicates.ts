// Client-safe predicates (mirrors backend/lib/dora/truth/predicates.ts)
// This is a client-side copy for UI filtering

export type RollupTab =
  | "ALL"
  | "CAND"
  | "TECH_CLUSTERS"
  | "MID_MARKET_INDIE"
  | "MEGA_CITIES"
  | "CORP_AGG"
  | "FRANCHISE";

export type Thresholds = {
  techClusterMinTech: number;
  midMarketMinTech: number;
  midMarketMaxTech: number;
  megaCityMinReg: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  techClusterMinTech: 10,
  midMarketMinTech: 50,
  midMarketMaxTech: 600,
  megaCityMinReg: 1000,
};

export type CityTruthRow = {
  cityKey: string;
  cityLabel: string;
  regCount: number;
  techCount: number;
  techPerReg: number;
  addrCount: number;
  candCount: number;
  segSummary: Record<string, number>;
  brandSummary?: Record<string, number>;
  reasons: string[];
};

// PATCH 4F: Simplified predicates based on truth data only
export const predicates = {
  ALL: (r: CityTruthRow) => true,

  CANDIDATES: (r: CityTruthRow) =>
    r.candCount > 0,

  TECH_CLUSTERS: (r: CityTruthRow) =>
    r.regCount > 0 && r.techCount >= 10,

  MID_MARKET_INDIE: (r: CityTruthRow) =>
    r.regCount > 0 && r.techCount >= 50 && r.techCount <= 600,

  MEGA_CITIES: (r: CityTruthRow) =>
    r.regCount >= 1000,

  // staged — show but intentionally empty
  CORPORATE_AGGREGATORS: (_r: CityTruthRow) => false,
  FRANCHISE_OWNERS: (_r: CityTruthRow) => false,
};

export function tabPredicate(tab: RollupTab, r: CityTruthRow, t = DEFAULT_THRESHOLDS): boolean {
  switch (tab) {
    case "ALL":
      return predicates.ALL(r);

    case "CAND":
      return predicates.CANDIDATES(r);

    case "TECH_CLUSTERS":
      return predicates.TECH_CLUSTERS(r);

    case "MID_MARKET_INDIE":
      return predicates.MID_MARKET_INDIE(r);

    case "MEGA_CITIES":
      return predicates.MEGA_CITIES(r);

    case "CORP_AGG":
      return predicates.CORPORATE_AGGREGATORS(r);

    case "FRANCHISE":
      return predicates.FRANCHISE_OWNERS(r);

    default:
      return true;
  }
}
