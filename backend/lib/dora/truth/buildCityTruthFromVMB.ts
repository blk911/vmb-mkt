import { computeCityKey } from "./keys";

export function buildCityTruthFromVMB({
  addressRows,
  licenseRows,
  candRows,
}: {
  addressRows: any[];
  licenseRows: any[];
  candRows: any[];
}) {
  // Map VMB address rows to normalized format
  const normalizedAddressRows = addressRows.map((a: any) => {
    const city = a.city || "";
    const state = a.state || "CO";
    const { cityKey, cityLabel } = computeCityKey(city, state);
    const addressId = String(a.addressKey || a.rollupKey || "").trim();
    
    return {
      addressId,
      cityKey,
      cityLabel,
      regCount: a.regCount || 0,
    };
  });

  // Map VMB license rows to normalized format
  const normalizedLicenseRows = licenseRows.map((l: any) => {
    const licenseId = String(l.licenseId || l["License Number"] || l["License"] || l.license_number || "").trim();
    const addressId = String(l.addressKey || l.addressId || "").trim();
    
    return {
      licenseId,
      addressId,
    };
  }).filter((l: any) => l.licenseId && l.addressId);

  // Map candidates
  const normalizedCandRows = candRows.map((c: any) => ({
    addressId: String(c.addressKey || c.addressId || "").trim(),
  })).filter((c: any) => c.addressId);

  // Build tech count by address
  const techByAddress = new Map<string, number>();
  for (const l of normalizedLicenseRows) {
    techByAddress.set(l.addressId, (techByAddress.get(l.addressId) || 0) + 1);
  }

  const candSet = new Set(normalizedCandRows.map((c: any) => c.addressId));

  const byCity = new Map<string, any>();

  for (const a of normalizedAddressRows) {
    const techCount = techByAddress.get(a.addressId) || 0;

    const row = byCity.get(a.cityKey) || {
      cityKey: a.cityKey,
      cityLabel: a.cityLabel,
      regCount: 0,
      techCount: 0,
      addrCount: 0,
      candCount: 0,
      reasons: [],
    };

    row.regCount += a.regCount || 0;
    row.techCount += techCount;
    row.addrCount += 1;
    if (candSet.has(a.addressId)) row.candCount += 1;

    byCity.set(a.cityKey, row);
  }

  return Array.from(byCity.values()).map(r => ({
    ...r,
    techPerReg: r.regCount > 0 ? Number((r.techCount / r.regCount).toFixed(2)) : r.techCount,
  }));
}
