export type FacilitySeedRow = {
  brand: string;
  locationLabel?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  category?: string; // SALON_CORP_CHAIN | SEAT_AGGREGATOR | ...
  source?: string;
  phone?: string;
  website?: string;
  types?: string[];
};

export function normSpace(s: unknown) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normUpper(s: unknown) {
  return normSpace(s).toUpperCase();
}

export function normZip(s: unknown) {
  // keep as string (leading zeros possible in other states)
  return normSpace(s);
}

export function normAddrLine(address1: unknown, address2?: unknown) {
  const one = normUpper(address1);
  const twoRaw = normUpper(address2 ?? "");
  if (!twoRaw) return one;

  // normalize common unit tokens
  const two = twoRaw
    .replace(/^SUITE\b/, "STE")
    .replace(/^STE\.?\b/, "STE")
    .replace(/^#\s*/, "STE ")
    .replace(/^UNIT\b/, "UNIT")
    .replace(/\s+/g, " ")
    .trim();

  return `${one} ${two}`.trim().replace(/\s+/g, " ");
}

export function addressKeyFromParts(
  r: Pick<FacilitySeedRow, "address1" | "address2" | "city" | "state" | "zip">
) {
  const street = normAddrLine(r.address1, r.address2);
  const city = normUpper(r.city);
  const state = normUpper(r.state);
  const zip = normZip(r.zip);
  return `${street} | ${city} | ${state} | ${zip}`;
}

export function slugify(s: unknown) {
  return normSpace(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function brandDefaultSeedFile(brand: string) {
  const b = slugify(brand || "facilities");
  return `${b}.locations.v1.jsonl`;
}
