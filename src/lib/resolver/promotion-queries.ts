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

export function buildSolaChildSurfaceRecoveryQueries(operator: ResolverOperator): string[] {
  const name = clean(operator.canonicalName);
  const city = clean(operator.canonicalCity);
  if (!name || !city) return [];
  const queries = [
    `${name} ${city} instagram`,
    `${name} ${city} glossgenius`,
    `${name} ${city} vagaro`,
    `${name} ${city} booksy`,
    `${name} ${city} website`,
  ];
  return [...new Set(queries.map(clean).filter(Boolean))].slice(0, 5);
}

export function buildDirectoryBackedSurfacePromotionQueries(
  operator: ResolverOperator,
  opts?: { maxQueries?: number }
): string[] {
  const maxQueries = Math.max(1, Math.min(6, opts?.maxQueries ?? 6));
  const name = clean(operator.canonicalName);
  const city = clean(operator.canonicalCity);
  const address = clean(operator.canonicalAddress);
  const phone = clean(operator.canonicalPhone);
  const website = clean(operator.canonicalWebsite);
  const booking = clean(operator.canonicalBooking);
  const hasWebsite = Boolean(website);
  const hasInstagram = Boolean(clean(operator.canonicalInstagram));
  const hasBooking = Boolean(booking);
  if (!name) return [];

  const queries = new Set<string>();

  if (city && hasWebsite && (!hasInstagram || !hasBooking)) {
    if (!hasInstagram) pushIf(queries, `${name} ${city} instagram`);
    if (!hasBooking) {
      pushIf(queries, `${name} ${city} glossgenius`);
      pushIf(queries, `${name} ${city} vagaro`);
      pushIf(queries, `${name} ${city} booksy`);
      pushIf(queries, `${name} ${city} fresha`);
    }
  }

  if (city && hasBooking && !hasWebsite) {
    pushIf(queries, `${name} ${city} website`);
    if (phone) pushIf(queries, `${name} ${phone}`);
    if (address) pushIf(queries, `${name} ${address} ${city}`);
    try {
      const bookingBrand = new URL(booking).hostname.replace(/^www\./, "").split(".")[0];
      pushIf(queries, `${bookingBrand} ${name}`);
    } catch {
      // ignore invalid booking urls
    }
  }

  if (city && !hasWebsite && !hasInstagram && !hasBooking) {
    pushIf(queries, `${name} ${city} website`);
    pushIf(queries, `${name} ${city} instagram`);
    pushIf(queries, `${name} ${city} booking`);
    if (phone) pushIf(queries, `${name} ${phone}`);
  }

  if (city && !hasInstagram && !queries.has(`${name} ${city} instagram`)) {
    pushIf(queries, `${name} ${city} instagram`);
  }
  if (city && !hasBooking && queries.size < maxQueries) {
    pushIf(queries, `${name} ${city} booking`);
  }
  if (city && !hasWebsite && queries.size < maxQueries) {
    pushIf(queries, `${name} ${city} website`);
  }

  if (phone && queries.size < maxQueries) pushIf(queries, `${name} ${phone}`);
  if (address && city && queries.size < maxQueries) pushIf(queries, `${name} ${address} ${city}`);
  if (website) {
    try {
      const domain = new URL(website).hostname.replace(/^www\./, "");
      if (!hasInstagram && queries.size < maxQueries) pushIf(queries, `${domain} instagram`);
      if (!hasBooking && queries.size < maxQueries) pushIf(queries, `${domain} booking`);
    } catch {
      // ignore invalid website urls
    }
  }
  return [...queries].slice(0, maxQueries);
}

