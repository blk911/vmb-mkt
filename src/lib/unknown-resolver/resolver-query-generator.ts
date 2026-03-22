import { canUseHouseCleaningScoring } from "./resolver-category-guards";
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

/** Dispatch by category; only house_cleaning gets query strings in v1. */
export function buildResolverQueries(record: UnknownResolverRecord): ResolverQuerySet {
  if (!canUseHouseCleaningScoring(record)) {
    return { recordId: record.id, queries: [] };
  }
  return buildHouseCleaningQueries(record);
}

/**
 * Deterministic 6–12 search-style queries for house cleaning triage.
 */
export function buildHouseCleaningQueries(record: UnknownResolverRecord): ResolverQuerySet {
  const nameRaw = record.sourceName?.trim() || record.normalizedName?.trim() || "";
  const norm = normalizeBusinessName(record.sourceName ?? record.normalizedName) || nameRaw.toLowerCase();
  const city = record.city?.trim() ?? "";
  const state = record.state?.trim() ?? "";
  const zip = record.zip?.trim() ?? "";
  const addr = compactAddress(record.address);

  const patterns: Array<string | null> = [
    q([`"${nameRaw}"`, `"${city}"`, "house cleaning"]),
    q([`"${nameRaw}"`, `"${city}"`, "home cleaning"]),
    q([`"${nameRaw}"`, `"${city}"`, "maid service"]),
    q([`"${nameRaw}"`, `"${city}"`, "residential cleaning"]),
    q([`"${nameRaw}"`, `"${state}"`, "cleaning service"]),
    q([`"${nameRaw}"`, "housekeeping", `"${city}"`]),
    q([`"${nameRaw}"`, "site:facebook.com", `"${city}"`]),
    q([`"${nameRaw}"`, "site:yelp.com", `"${city}"`]),
    q([`"${nameRaw}"`, "site:thumbtack.com", `"${city}"`]),
  ];

  const street = maybeStreetFragment(record.address);
  if (street && city) {
    patterns.push(q([`"${street}"`, `"${city}"`, "house cleaning"]));
  }
  if (addr && city) {
    patterns.push(q(["house cleaning near", `"${addr}"`]));
  }
  if (zip) {
    patterns.push(q(["residential cleaning", `"${zip}"`]));
  }
  if (norm && city && !nameRaw) {
    patterns.push(q([norm, city, "maid service"]));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of patterns) {
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }

  if (!nameRaw && (city || zip)) {
    const anon = [
      q([`"${city}"`, "house cleaning", zip ? `"${zip}"` : ""]),
      q(["residential cleaning", `"${city}"`, `"${state}"`]),
      q(["maid service", `"${zip}"`]),
    ];
    for (const a of anon) {
      if (a && !seen.has(a)) {
        seen.add(a);
        out.push(a);
      }
    }
  }

  const limited = out.slice(0, 12);
  while (limited.length < 6 && nameRaw && city) {
    const filler = q([`"${nameRaw}"`, `"${city}"`, "cleaning"]);
    if (filler && !seen.has(filler)) {
      seen.add(filler);
      limited.push(filler);
    } else break;
  }

  return { recordId: record.id, queries: limited };
}
