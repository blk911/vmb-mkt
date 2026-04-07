import type { ResolverOperator } from "./types";

function clean(value?: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function pushIf(set: Set<string>, value: string) {
  const v = clean(value);
  if (v) set.add(v);
}

export function buildPromotionQueries(operator: ResolverOperator): string[] {
  const name = clean(operator.canonicalName);
  const city = clean(operator.canonicalCity);
  const address = clean(operator.canonicalAddress);
  const phone = clean(operator.canonicalPhone);
  const website = clean(operator.canonicalWebsite);
  const booking = clean(operator.canonicalBooking);

  const queries = new Set<string>();
  if (name && city) pushIf(queries, `${name} ${city} booking`);
  if (name && city) pushIf(queries, `${name} ${city} instagram`);
  if (name && address) pushIf(queries, `${name} ${address}`);
  if (phone) pushIf(queries, phone);
  if (website && name) {
    pushIf(queries, `${website} instagram`);
    pushIf(queries, `${website} booking`);
  }
  if (booking && name && city) {
    try {
      const domain = new URL(booking).hostname.replace(/^www\./, "");
      pushIf(queries, `${name} ${city} ${domain}`);
    } catch {
      // ignore invalid booking url
    }
  }

  return [...queries].slice(0, 5);
}

