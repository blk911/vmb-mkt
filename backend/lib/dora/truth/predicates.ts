import type { CityTruthRow } from "./types";

export type RollupTab =
  | "ALL"
  | "CAND"
  | "TECH_CLUSTERS"
  | "MID_MARKET_INDIE"
  | "MEGA_CITIES"
  | "CORP_AGG"
  | "FRANCHISE";

export type Thresholds = {
  techClusterMinTech: number; // ex: 10
  midMarketMinTech: number; // ex: 50
  midMarketMaxTech: number; // ex: 600
  megaCityMinReg: number; // ex: 1000
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  techClusterMinTech: 10,
  midMarketMinTech: 50,
  midMarketMaxTech: 600,
  megaCityMinReg: 1000,
};

export function tabPredicate(tab: RollupTab, r: CityTruthRow, t = DEFAULT_THRESHOLDS): boolean {
  switch (tab) {
    case "ALL":
      return true;

    case "CAND":
      // City is in CAND tab if it has at least 1 candidate address.
      return r.candCount > 0;

    case "TECH_CLUSTERS":
      // tech density cities; require regCount>0 to avoid nonsense
      return r.regCount > 0 && r.techCount >= t.techClusterMinTech;

    case "MID_MARKET_INDIE":
      // Based on tech count range and not mega-city
      return r.regCount > 0 && r.techCount >= t.midMarketMinTech && r.techCount <= t.midMarketMaxTech;

    case "MEGA_CITIES":
      return r.regCount >= t.megaCityMinReg;

    case "CORP_AGG":
      // corp-owned signal: any corp-owned addresses in city
      return (r.segSummary["CORP_OWNED"] || 0) > 0;

    case "FRANCHISE":
      return (r.segSummary["CORP_FRANCHISE"] || 0) > 0;

    default:
      return true;
  }
}
