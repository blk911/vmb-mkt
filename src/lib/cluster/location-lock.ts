import type { BaseEntity, LocationLockResult } from "./types";
import { normalizeAddress } from "./normalize";

/**
 * Hard location lock (gate, not a score input): high match score without one of these must not attach.
 * - Exact normalized address is strongest signal.
 * - Suite match is strong in multi-tenant retail (same unit id).
 * - Same building / pad is fallback for slight address or geocode drift.
 */

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

function extractSuiteToken(addr?: string): string[] {
  if (!addr) return [];
  const m = addr.toLowerCase().match(/\b(?:ste|suite|unit|apt|#)\s*([a-z0-9-]+)/g);
  if (!m) return [];
  return m.map((x) => x.replace(/\s+/g, ""));
}

/**
 * Structured lock result: machine-readable explanation of why a row survived the gate (or didn't).
 */
export function getLocationLockResult(a: BaseEntity, b: BaseEntity): LocationLockResult {
  const aAddr = normalizeAddress(a.address);
  const bAddr = normalizeAddress(b.address);

  const normalizedAddressMatchExact =
    !!aAddr && !!bAddr && aAddr.length >= 6 && bAddr.length >= 6 && aAddr === bAddr;

  const aSuites = extractSuiteToken(a.address);
  const bSuites = extractSuiteToken(b.address);

  const suiteMatch =
    aSuites.length > 0 && bSuites.length > 0 && aSuites.some((s) => bSuites.includes(s));

  const d = approxDistanceMiles(a, b);

  const sameStreetNumber =
    !!a.address &&
    !!b.address &&
    (a.address.match(/^\s*\d+/)?.[0] || "") === (b.address.match(/^\s*\d+/)?.[0] || "");

  const samePrefix =
    !!aAddr &&
    !!bAddr &&
    aAddr.slice(0, 12).length >= 8 &&
    aAddr.slice(0, 12) === bAddr.slice(0, 12);

  const samePad = d <= 0.025;

  const sameBuildingParcel =
    d <= 0.08 && ((sameStreetNumber && d <= 0.06) || samePrefix || samePad);

  const hasLock = normalizedAddressMatchExact || suiteMatch || sameBuildingParcel;

  const lockType: LocationLockResult["lockType"] = normalizedAddressMatchExact
    ? "exact_address"
    : suiteMatch
      ? "suite_match"
      : sameBuildingParcel
        ? "same_building_parcel"
        : "none";

  return {
    hasLock,
    lockType,
    normalizedAddressMatchExact,
    suiteMatch,
    sameBuildingParcel,
  };
}

export function hasHardLocationLock(a: BaseEntity, b: BaseEntity): boolean {
  return getLocationLockResult(a, b).hasLock;
}
