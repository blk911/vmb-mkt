import type { ResolverQuerySet, UnknownResolverRecord } from "./resolver-types";
import { compactAddress, maybeStreetFragment, normalizeBusinessName } from "./resolver-normalize";

function q(parts: Array<string | null | undefined>): string | null {
  const s = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length >= 3 ? s : null;
}

/**
 * Deterministic 6–14 search-style queries for nails triage.
 */
export function buildNailsQueries(record: UnknownResolverRecord): ResolverQuerySet {
  const nameRaw = record.sourceName?.trim() || record.normalizedName?.trim() || "";
  const city = record.city?.trim() ?? "";
  const state = record.state?.trim() ?? "";
  const zip = record.zip?.trim() ?? "";
  const addr = compactAddress(record.address);
  const norm = normalizeBusinessName(record.sourceName ?? record.normalizedName) || nameRaw.toLowerCase();

  const patterns: Array<string | null> = [
    q([`"${nameRaw}"`, `"${city}"`, "nail salon"]),
    q([`"${nameRaw}"`, `"${city}"`, "nail studio"]),
    q([`"${nameRaw}"`, "manicure", `"${city}"`]),
    q([`"${nameRaw}"`, "pedicure", `"${city}"`]),
    q([`"${nameRaw}"`, "acrylic nails", `"${city}"`]),
    q([`"${nameRaw}"`, "gel x", `"${city}"`]),
    q([`"${nameRaw}"`, "nail art", `"${city}"`]),
    q([`"${nameRaw}"`, "site:instagram.com", "nails"]),
    q([`"${nameRaw}"`, "site:facebook.com", "nail salon"]),
    q([`"${nameRaw}"`, "site:yelp.com", "nail salon"]),
    q([`"${nameRaw}"`, "site:booksy.com"]),
    q([`"${nameRaw}"`, "site:vagaro.com"]),
    q([`"${nameRaw}"`, "site:glossgenius.com"]),
    q([`"${nameRaw}"`, `"${state}"`, "nail tech"]),
  ];

  const street = maybeStreetFragment(record.address);
  if (street && city) {
    patterns.push(q([`"${street}"`, "nails", `"${city}"`]));
  }
  if (addr && city) {
    patterns.push(q(["nail salon near", `"${addr}"`]));
  }
  if (zip) {
    patterns.push(q(["manicure", `"${zip}"`]));
  }
  if (norm && city && !nameRaw) {
    patterns.push(q([norm, city, "nail studio"]));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of patterns) {
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }

  const limited = out.slice(0, 14);
  while (limited.length < 6 && nameRaw && city) {
    const filler = q([`"${nameRaw}"`, `"${city}"`, "nails"]);
    if (filler && !seen.has(filler)) {
      seen.add(filler);
      limited.push(filler);
    } else break;
  }

  return { recordId: record.id, queries: limited };
}
