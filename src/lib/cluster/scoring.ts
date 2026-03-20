import type { BaseEntity, DiagnosticCode, MatchBreakdown } from "./types";
import { brandCoreTokens, nameTokens, normalizeAddress } from "./normalize";

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

function scoreDistance(d: number): { score: number; code: DiagnosticCode } {
  if (d <= 0.02) return { score: 35, code: "DIST_NEAR" };
  if (d <= 0.04) return { score: 30, code: "DIST_NEAR" };
  if (d <= 0.06) return { score: 24, code: "DIST_NEAR" };
  if (d <= 0.1) return { score: 16, code: "DIST_NEAR" };
  if (d <= 0.16) return { score: 8, code: "DIST_FAR" };
  return { score: 0, code: "DIST_FAR" };
}

function overlapCount(a: string[], b: string[]): number {
  return a.filter((t) => b.includes(t)).length;
}

function scoreName(a: BaseEntity, b: BaseEntity): { score: number; code: DiagnosticCode } {
  const aCore = brandCoreTokens(a.name);
  const bCore = brandCoreTokens(b.name);

  const coreOverlap = overlapCount(aCore, bCore);

  if (coreOverlap >= 2) return { score: 30, code: "NAME_STRONG" };
  if (coreOverlap === 1) return { score: 22, code: "NAME_STRONG" };

  const aFull = nameTokens(a.name);
  const bFull = nameTokens(b.name);
  const fullOverlap = overlapCount(aFull, bFull);

  if (fullOverlap >= 2) return { score: 18, code: "NAME_STRONG" };
  if (fullOverlap === 1) return { score: 8, code: "NAME_WEAK" };

  return { score: 0, code: "NAME_WEAK" };
}

function scoreCategory(a: BaseEntity, b: BaseEntity): { score: number; code: DiagnosticCode } {
  if (!a.category || !b.category) {
    return { score: 0, code: "CATEGORY_CONFLICT" };
  }

  if (a.category === b.category) {
    return { score: 15, code: "CATEGORY_MATCH" };
  }

  const broadFamily = ["hair", "barber", "nail", "spa"];
  if (broadFamily.includes(a.category) && broadFamily.includes(b.category)) {
    return { score: 5, code: "CATEGORY_MATCH" };
  }

  return { score: 0, code: "CATEGORY_CONFLICT" };
}

function scoreAddress(a: BaseEntity, b: BaseEntity): { score: number; code: DiagnosticCode } {
  const aAddr = normalizeAddress(a.address);
  const bAddr = normalizeAddress(b.address);

  if (!aAddr || !bAddr) {
    return { score: 0, code: "NO_USABLE_ADDRESS" };
  }

  if (aAddr === bAddr) {
    return { score: 15, code: "ADDR_MATCH" };
  }

  const shortA = aAddr.slice(0, 12);
  const shortB = bAddr.slice(0, 12);
  if (shortA && shortA === shortB) {
    return { score: 9, code: "ADDR_PARTIAL" };
  }

  return { score: 0, code: "NO_USABLE_ADDRESS" };
}

function scoreSupport(a: BaseEntity, b: BaseEntity): number {
  let score = 0;

  if (a.phone && b.phone && a.phone === b.phone) score += 3;

  const aHost = (a.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const bHost = (b.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (aHost && bHost && aHost === bHost) score += 2;

  return score;
}

export function buildMatchBreakdown(a: BaseEntity, b: BaseEntity): MatchBreakdown {
  const diagnostics: DiagnosticCode[] = [];

  const distanceMiles = approxDistanceMiles(a, b);
  const d = scoreDistance(distanceMiles);
  diagnostics.push(d.code);

  const n = scoreName(a, b);
  diagnostics.push(n.code);

  const c = scoreCategory(a, b);
  diagnostics.push(c.code);

  const addr = scoreAddress(a, b);
  diagnostics.push(addr.code);

  const supportScore = scoreSupport(a, b);

  const score = d.score + n.score + c.score + addr.score + supportScore;

  return {
    score,
    distanceMiles,
    distanceScore: d.score,
    nameScore: n.score,
    categoryScore: c.score,
    addressScore: addr.score,
    supportScore,
    diagnostics,
  };
}
