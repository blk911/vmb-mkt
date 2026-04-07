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

  const queries = new Set<string>();
  if (name && city) {
    pushIf(queries, `${name} ${city} instagram`);
    pushIf(queries, `${name} ${city} booking`);
    pushIf(queries, `${name} ${city} glossgenius`);
    pushIf(queries, `${name} ${city} styleseat`);
    pushIf(queries, `${name} ${city} vagaro`);
    pushIf(queries, `${name} ${city} fresha`);
  }
  if (name && address) pushIf(queries, `${name} ${address}`);
  if (phone) pushIf(queries, phone);
  if (website) {
    pushIf(queries, `${website} instagram`);
    pushIf(queries, `${website} booking`);
  }

  return [...queries].slice(0, 6);
}

