import type { CityTruthRow } from "./types";
import type { AddressTruthRow } from "./types";

export function buildCityTruth(addressRows: AddressTruthRow[]) {
  const byCity = new Map<
    string,
    {
      cityKey: string;
      cityLabel: string;
      regCount: number;
      techCount: number;
      addrCount: number;
      candCount: number;
      segSummary: Record<string, number>;
      brandSummary: Record<string, number>;
      reasons: string[];
    }
  >();

  function upsert(cityKey: string, cityLabel: string) {
    if (!byCity.has(cityKey)) {
      byCity.set(cityKey, {
        cityKey,
        cityLabel,
        regCount: 0,
        techCount: 0,
        addrCount: 0,
        candCount: 0,
        segSummary: {},
        brandSummary: {},
        reasons: [],
      });
    }
    return byCity.get(cityKey)!;
  }

  for (const a of addressRows) {
    const row = upsert(a.cityKey, a.cityLabel);
    row.addrCount += 1;
    row.regCount += a.regCount;
    row.techCount += a.techCount;
    row.candCount += a.cand ? 1 : 0;

    row.segSummary[a.seg] = (row.segSummary[a.seg] || 0) + 1;

    if (a.brandKey) {
      row.brandSummary[a.brandKey] = (row.brandSummary[a.brandKey] || 0) + 1;
    }
  }

  const out: CityTruthRow[] = [];
  for (const v of byCity.values()) {
    // Safe division:
    // If regCount==0 but techCount>0, techPerReg should not be 9999 unless we explicitly mark reason.
    const techPerReg = v.regCount > 0 ? v.techCount / v.regCount : v.techCount > 0 ? v.techCount : 0;

    const reasons: string[] = [];
    if (v.regCount === 0 && v.techCount > 0) reasons.push("REG==0 but TECH>0 (solo/unmatched in this city rollup)");
    if ((v.segSummary["CORP_FRANCHISE"] || 0) > 0) reasons.push("has franchise addresses");
    if ((v.segSummary["CORP_OWNED"] || 0) > 0) reasons.push("has corp-owned addresses");
    if (v.candCount > 0) reasons.push("has candidate indie addresses");

    out.push({
      cityKey: v.cityKey,
      cityLabel: v.cityLabel,
      regCount: v.regCount,
      techCount: v.techCount,
      techPerReg: Number(techPerReg.toFixed(2)),
      addrCount: v.addrCount,
      candCount: v.candCount,
      segSummary: v.segSummary,
      brandSummary: Object.keys(v.brandSummary).length ? v.brandSummary : undefined,
      reasons,
    });
  }

  out.sort((a, b) => a.cityLabel.localeCompare(b.cityLabel));
  return out;
}
