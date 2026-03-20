import type { BaseEntity } from "./types";
import { normalizeAddress } from "./normalize";

function approxDistanceMiles(a: BaseEntity, b: BaseEntity): number {
  if (
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    return 999;
  }
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy) * 69;
}

function streetNumber(addr?: string): string {
  const m = (addr || "").trim().match(/^(\d+)/);
  return m ? m[1] : "";
}

function extractSuiteTokens(addr?: string): string[] {
  if (!addr) return [];
  const re = /\b(?:ste|suite|unit|apt|#)\s*([a-z0-9]+)\b/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(addr)) !== null) {
    out.push(m[1].toLowerCase());
  }
  return out;
}

/** Normalized full-address equality (after normalizeAddress). */
export function normalizedAddressMatchExact(a: BaseEntity, b: BaseEntity): boolean {
  const na = normalizeAddress(a.address);
  const nb = normalizeAddress(b.address);
  if (na.length < 6 || nb.length < 6) return false;
  return na === nb;
}

/** Both addresses include a suite/unit id and at least one token matches. */
export function suiteMatch(a: BaseEntity, b: BaseEntity): boolean {
  const sa = extractSuiteTokens(a.address);
  const sb = extractSuiteTokens(b.address);
  if (!sa.length || !sb.length) return false;
  return sa.some((t) => sb.includes(t));
}

/**
 * Same building / parcel: tight GPS, or same street number + close pin,
 * or long normalized-address prefix agreement.
 */
export function sameBuildingParcel(a: BaseEntity, b: BaseEntity): boolean {
  const d = approxDistanceMiles(a, b);
  if (d > 0.08) return false;

  const na = streetNumber(a.address);
  const nb = streetNumber(b.address);
  if (na && nb && na === nb && d <= 0.06) return true;

  const pa = normalizeAddress(a.address);
  const pb = normalizeAddress(b.address);
  if (pa.length >= 12 && pb.length >= 12 && pa.slice(0, 12) === pb.slice(0, 12)) return true;

  // Same pad / building — very tight geocode
  if (d <= 0.025) return true;

  return false;
}

/**
 * HARD LOCATION LOCK — required before an entity counts as a primary cluster candidate
 * (not "nearby noise only").
 */
export function hasHardLocationLock(a: BaseEntity, b: BaseEntity): boolean {
  return (
    normalizedAddressMatchExact(a, b) ||
    sameBuildingParcel(a, b) ||
    suiteMatch(a, b)
  );
}
