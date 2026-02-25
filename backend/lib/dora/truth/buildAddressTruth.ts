import type { AddressTruthRow, Segment } from "./types";
import { computeAddressId, computeCityKey, normZip } from "./keys";

// NOTE: This is PH1 truth: we do not "guess" corp-owned yet unless you already have corp keys.
// We DO support franchise brandKey if you have a franchise registry match field.
// If you don't, brandKey stays undefined and CORP_FRANCHISE counts will be zero (truthful).

function uniq(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean)));
}

// Minimal heuristic for SOLO buckets at address-level
function segForAddress(regCount: number, techCount: number, brandKey?: string): { seg: Segment; reasons: string[] } {
  const reasons: string[] = [];

  if (regCount > 0 && techCount > 0) reasons.push("REG>0 & TECH>0");
  if (regCount === 0 && techCount > 0) reasons.push("REG==0 & TECH>0 (SOLO/UNMATCHED?)");
  if (brandKey) reasons.push(`brand=${brandKey}`);

  // franchise wins over indie
  if (brandKey) return { seg: "CORP_FRANCHISE", reasons: [...reasons, "seg=CORP_FRANCHISE"] };

  if (regCount > 0) return { seg: "INDIE", reasons: [...reasons, "seg=INDIE(default PH1)"] };

  // No facility at address, but tech exists => solo address bucket
  if (techCount > 0) return { seg: "SOLO_AT_SOLO", reasons: [...reasons, "seg=SOLO_AT_SOLO"] };

  return { seg: "UNKNOWN", reasons: [...reasons, "seg=UNKNOWN"] };
}

export function buildAddressTruth(input: {
  facilities: any[];
  licensees: any[];
  // Optional: a function that maps a facility row to a franchise brand id (if you already have it)
  facilityBrandKey?: (f: any) => string | undefined;
}) {
  // addressId -> aggregation
  const map = new Map<
    string,
    {
      addressId: string;
      addressKey: string;
      cityKey: string;
      cityLabel: string;
      zip5: string;
      facilityIds: string[];
      techIds: string[];
      brandKeys: string[];
    }
  >();

  function upsert(addr: {
    addressId: string;
    addressKey: string;
    cityKey: string;
    cityLabel: string;
    zip5: string;
  }) {
    if (!map.has(addr.addressId)) {
      map.set(addr.addressId, {
        ...addr,
        facilityIds: [],
        techIds: [],
        brandKeys: [],
      });
    }
    return map.get(addr.addressId)!;
  }

  // Facilities → reg presence at address
  for (const f of input.facilities || []) {
    const facilityId = String(f.facilityId || f.id || "").trim();
    const street1 = f.street1 || f.address1 || f.address || f.street || f["Street Address"] || "";
    const street2 = f.street2 || f.address2 || f["Street Address 2"] || "";
    const city = f.city || f.City || "";
    const state = f.state || f.State || "CO";
    const zip = f.zip || f.zipCode || f["Zip Code"] || "";

    if (!street1 || !city) continue;

    const { addressId, addressKey } = computeAddressId(street1, street2, city, state, zip);
    const { cityKey, cityLabel } = computeCityKey(city, state);
    const zip5 = normZip(zip);

    const row = upsert({ addressId, addressKey, cityKey, cityLabel, zip5 });

    if (facilityId) row.facilityIds.push(facilityId);

    const bk = input.facilityBrandKey?.(f);
    if (bk) row.brandKeys.push(bk);
  }

  // Licensees → tech presence at address
  for (const t of input.licensees || []) {
    const techId = String(t.licenseId || t.license_id || t.license_number || t["License Number"] || t.License || t.id || "").trim();
    const street1 = t.street1 || t.address1 || t.address || t.street || t["Street Address"] || t["Mail Street Address"] || "";
    const street2 = t.street2 || t.address2 || t["Street Address 2"] || "";
    const city = t.city || t.City || "";
    const state = t.state || t.State || "CO";
    const zip = t.zip || t.zipCode || t["Zip Code"] || t["Mail Zip Code"] || "";

    if (!techId || !street1 || !city) continue;

    const { addressId, addressKey } = computeAddressId(street1, street2, city, state, zip);
    const { cityKey, cityLabel } = computeCityKey(city, state);
    const zip5 = normZip(zip);

    const row = upsert({ addressId, addressKey, cityKey, cityLabel, zip5 });
    row.techIds.push(techId);
  }

  const out: AddressTruthRow[] = [];
  for (const v of map.values()) {
    const facilityIds = uniq(v.facilityIds);
    const techIds = uniq(v.techIds);
    const brandKeys = uniq(v.brandKeys);

    const regCount = facilityIds.length;
    const techCount = techIds.length;
    const brandKey = brandKeys[0]; // PH1: first match wins; later we can support multi

    const { seg, reasons } = segForAddress(regCount, techCount, brandKey);

    // Candidate logic (PH1): indie address with meaningful tech count
    const cand: 0 | 1 = seg === "INDIE" && techCount >= 2 ? 1 : 0; // adjust threshold later

    const candReason = cand ? "cand=1 (INDIE & tech>=2)" : "cand=0";

    out.push({
      addressId: v.addressId,
      addressKey: v.addressKey,
      cityKey: v.cityKey,
      cityLabel: v.cityLabel,
      zip5: v.zip5,
      regCount,
      facilityIds,
      techCount,
      techIds,
      seg,
      brandKey,
      cand,
      reasons: [...reasons, candReason],
    });
  }

  // Stable sort for deterministic outputs
  out.sort((a, b) => a.cityLabel.localeCompare(b.cityLabel) || a.addressId.localeCompare(b.addressId));
  return out;
}
