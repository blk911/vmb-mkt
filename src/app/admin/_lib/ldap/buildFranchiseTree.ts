type Facility = {
  facilityId?: string;
  id?: string;
  segment?: string;
  franchiseBrandId?: string;
  [key: string]: any;
};

type FranchiseBrandNode = {
  brandId: string;
  displayName?: string;
  count: number;
  facilities: string[];
};

export function buildFranchiseTree(facilities: Facility[]): FranchiseBrandNode[] {
  const byBrand = new Map<string, FranchiseBrandNode>();

  for (const f of facilities) {
    if (f.segment !== "corp_franchise" || !f.franchiseBrandId) continue;

    const brandId = f.franchiseBrandId;
    const facilityId = f.facilityId || f.id || String(Math.random());

    if (!byBrand.has(brandId)) {
      byBrand.set(brandId, {
        brandId,
        displayName: brandId, // Will be enriched from registry
        count: 0,
        facilities: [],
      });
    }

    const node = byBrand.get(brandId)!;
    node.count += 1;
    node.facilities.push(facilityId);
  }

  return Array.from(byBrand.values()).sort((a, b) => b.count - a.count);
}
