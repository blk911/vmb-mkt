import type { ResolverOperator } from "./types";

export type DirectoryBackedPromotionCandidate = {
  operator: ResolverOperator;
  score: number;
  reasons: string[];
  hardAnchors: string[];
  missingSurfaces: Array<"website" | "instagram" | "booking">;
};

export type DirectoryBackedPromotionNearMiss = {
  operatorId: string;
  name?: string;
  score: number;
  hardAnchors: string[];
  missingSurfaces: Array<"website" | "instagram" | "booking">;
  reasonsRejected: string[];
};

export type DirectoryBackedPromotionSelection = {
  candidates: DirectoryBackedPromotionCandidate[];
  nearMisses: DirectoryBackedPromotionNearMiss[];
  candidateThreshold: number;
  candidateHardAnchorCount: number;
  skippedAlreadyEnriched: number;
  skippedSolaOnly: number;
  skippedCanonicalConflict: number;
  skippedMergedAway: number;
};

type ScoredOperator = {
  score: number;
  reasons: string[];
  hardAnchors: string[];
  missingSurfaces: Array<"website" | "instagram" | "booking">;
};

function isProvisionalName(value?: string): boolean {
  const text = (value || "").toLowerCase().trim();
  if (!text) return true;
  if (!text.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text);
}

function hasLikelyClosedSignal(op: ResolverOperator): boolean {
  return op.sources.some((row) => {
    const text = `${row.name || ""} ${row.sourceUrl || ""} ${JSON.stringify(row.raw || {})}`.toLowerCase();
    return /(permanently closed|temporarily closed|closed|shut down|no longer in business)/.test(text);
  });
}

function hostFromUrl(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isSolaHost(host: string): boolean {
  return host.includes("solasalons.com") || host.includes("solasalonstudios.com");
}

function getOptionalFlag(op: ResolverOperator, keys: string[]): boolean {
  const record = op as unknown as Record<string, unknown>;
  return keys.some((key) => record[key] === true);
}

function getOptionalString(op: ResolverOperator, keys: string[]): string {
  const record = op as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return "";
}

function hasCanonicalConflict(op: ResolverOperator): boolean {
  if (getOptionalFlag(op, ["canonicalConflict", "hasCanonicalConflict"])) return true;
  const state = getOptionalString(op, ["canonicalConflictState", "canonicalState", "resolutionStatus"]);
  return state === "conflict";
}

function isMergedAway(op: ResolverOperator): boolean {
  if (getOptionalFlag(op, ["mergedAway", "isMergedAway"])) return true;
  const record = op as unknown as Record<string, unknown>;
  if (typeof record.mergedIntoId === "string" && record.mergedIntoId.trim()) return true;
  if (typeof record.duplicateOfId === "string" && record.duplicateOfId.trim()) return true;
  const state = getOptionalString(op, ["mergeState", "duplicateState"]);
  return state === "merged_away" || state === "duplicate_loser";
}

function isSuppressedOrInactive(op: ResolverOperator): boolean {
  if (getOptionalFlag(op, ["suppressed", "inactive", "isInactive"])) return true;
  const state = getOptionalString(op, ["canonicalState", "lifecycleState", "activeState"]);
  return state === "suppressed" || state === "inactive";
}

function isSolaOnlyIdentity(op: ResolverOperator): boolean {
  if (!op.sources.length) return true;
  const nonSolaSources = op.sources.filter((row) => {
    const host = hostFromUrl(row.sourceUrl);
    return !isSolaHost(host);
  });
  return nonSolaSources.length === 0;
}

function nonSolaSources(op: ResolverOperator) {
  return op.sources.filter((row) => !isSolaHost(hostFromUrl(row.sourceUrl)));
}

function hasDirectoryLikeEvidence(op: ResolverOperator): boolean {
  return op.sources.some((row) => {
    if (row.source === "directory" || row.source === "google") return true;
    return row.evidenceType === "directory_listing";
  });
}

function hasKnownWebsite(op: ResolverOperator): boolean {
  return Boolean(op.canonicalWebsite || op.sources.some((row) => Boolean(row.website)));
}

function hasKnownPhone(op: ResolverOperator): boolean {
  return Boolean(op.canonicalPhone || op.sources.some((row) => Boolean(row.phone)));
}

function hasGeoCoherence(op: ResolverOperator): boolean {
  if (op.canonicalAddress && op.canonicalCity) return true;
  if (op.canonicalAddress && op.sources.some((row) => row.city === op.canonicalCity)) return true;
  return Boolean(op.canonicalCity && op.sources.some((row) => row.address || row.city === op.canonicalCity));
}

function hasBeautyServiceSignal(op: ResolverOperator): boolean {
  if (op.normalizedCategory && op.normalizedCategory !== "unknown") return true;
  const haystack = [op.category || "", op.canonicalName || "", op.parentContainerName || ""].join(" ").toLowerCase();
  return /(nail|lash|brow|esthetic|esthe|spa|salon|beauty|barber|hair|studio)/.test(haystack);
}

function nonSolaCorroborationCount(op: ResolverOperator): number {
  const kinds = new Set<string>();
  for (const row of nonSolaSources(op)) {
    if (row.source) kinds.add(row.source);
    if (row.evidenceType) kinds.add(row.evidenceType);
  }
  return kinds.size;
}

function strongIdentity(op: ResolverOperator): boolean {
  if (!op.canonicalName || isProvisionalName(op.canonicalName)) return false;
  return Boolean(op.canonicalCity || op.canonicalAddress || op.canonicalPhone);
}

function missingSurfaces(op: ResolverOperator): Array<"website" | "instagram" | "booking"> {
  const out: Array<"website" | "instagram" | "booking"> = [];
  if (!op.canonicalWebsite) out.push("website");
  if (!op.canonicalInstagram) out.push("instagram");
  if (!op.canonicalBooking) out.push("booking");
  return out;
}

function scoreOperator(op: ResolverOperator): ScoredOperator {
  const reasons: string[] = [];
  const anchors: string[] = [];
  const missing = missingSurfaces(op);
  const hasDirectory = hasDirectoryLikeEvidence(op);
  const hasWebsite = hasKnownWebsite(op);
  const hasPhone = hasKnownPhone(op);
  const geoCoherent = hasGeoCoherence(op);
  const corroborationCount = nonSolaCorroborationCount(op);

  if (hasDirectory) anchors.push("directory/place evidence");
  if (hasWebsite) anchors.push("known website/domain");
  if (hasPhone && geoCoherent) anchors.push("phone + geo coherence");
  if (corroborationCount >= 2) anchors.push("2+ non-Sola corroborating sources");

  let score = 0;
  if (strongIdentity(op)) {
    score += 3;
    reasons.push("strong canonical identity");
  }
  if (hasDirectory) {
    score += 3;
    reasons.push("directory/place detail evidence");
  }
  if (hasPhone) {
    score += 2;
    reasons.push("known phone");
  }
  if (geoCoherent) {
    score += 2;
    reasons.push("coherent geo anchor");
  }
  if (corroborationCount >= 2) {
    score += 2;
    reasons.push("multi-source corroboration");
  }

  if (op.canonicalWebsite && (!op.canonicalInstagram || !op.canonicalBooking)) {
    score += 3;
    reasons.push("website present with missing direct surface");
  }
  if (op.canonicalInstagram && (!op.canonicalWebsite || !op.canonicalBooking)) {
    score += 3;
    reasons.push("instagram present with missing corroborating surface");
  }
  if (op.canonicalBooking && (!op.canonicalWebsite || !op.canonicalInstagram)) {
    score += 3;
    reasons.push("booking present with missing corroborating surface");
  }
  if (!op.canonicalWebsite && !op.canonicalInstagram && !op.canonicalBooking && (hasDirectory || (hasPhone && geoCoherent))) {
    score += 1;
    reasons.push("anchored but missing all direct surfaces");
  }
  if (missing.length >= 2 && anchors.length >= 1) {
    score += 2;
    reasons.push("multiple direct surfaces still missing");
  }

  if (hasLikelyClosedSignal(op)) {
    score -= 4;
    reasons.push("likely closed/dead signal");
  }
  if (!geoCoherent) {
    score -= 3;
    reasons.push("weak geo anchor");
  }
  if (nonSolaSources(op).length <= 1) {
    score -= 3;
    reasons.push("only one thin non-Sola source");
  }
  if (isProvisionalName(op.canonicalName) || (!strongIdentity(op) && corroborationCount < 2)) {
    score -= 2;
    reasons.push("ambiguous identity");
  }

  return {
    score,
    reasons,
    hardAnchors: anchors,
    missingSurfaces: missing,
  };
}

export function selectDirectoryBackedPromotionCandidates(
  operators: ResolverOperator[],
  opts?: { limit?: number; minScore?: number }
): DirectoryBackedPromotionSelection {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 80));
  const minScore = opts?.minScore ?? 4;

  let skippedAlreadyEnriched = 0;
  let skippedSolaOnly = 0;
  let skippedCanonicalConflict = 0;
  let skippedMergedAway = 0;
  let candidateHardAnchorCount = 0;

  const rows: DirectoryBackedPromotionCandidate[] = [];
  const nearMisses: DirectoryBackedPromotionNearMiss[] = [];

  for (const op of operators) {
    if (op.status === "hot" || op.status === "enriched" || op.status === "ready") {
      skippedAlreadyEnriched += 1;
      continue;
    }
    if (hasCanonicalConflict(op)) {
      skippedCanonicalConflict += 1;
      continue;
    }
    if (isMergedAway(op) || isSuppressedOrInactive(op)) {
      skippedMergedAway += 1;
      continue;
    }
    if (op.status !== "enumerated") continue;
    if (op.isContainer) continue;

    const solaOnly = isSolaOnlyIdentity(op);
    if (solaOnly) {
      skippedSolaOnly += 1;
      continue;
    }

    const scored = scoreOperator(op);
    if (scored.hardAnchors.length > 0) candidateHardAnchorCount += 1;

    const rejected: string[] = [];
    if (!hasBeautyServiceSignal(op)) rejected.push("weak beauty/service fit");
    if (!strongIdentity(op)) rejected.push("weak canonical identity");
    if (!scored.hardAnchors.length) rejected.push("missing hard anchor");
    if (!scored.missingSurfaces.length) rejected.push("no missing key surface");
    if (hasLikelyClosedSignal(op)) rejected.push("likely closed/dead");
    if (scored.score < minScore) rejected.push(`score below threshold ${minScore}`);

    if (
      !hasBeautyServiceSignal(op) ||
      !strongIdentity(op) ||
      !scored.hardAnchors.length ||
      !scored.missingSurfaces.length ||
      hasLikelyClosedSignal(op) ||
      scored.score < minScore
    ) {
      if (hasBeautyServiceSignal(op) || strongIdentity(op) || scored.hardAnchors.length) {
        nearMisses.push({
          operatorId: op.id,
          name: op.canonicalName,
          score: scored.score,
          hardAnchors: scored.hardAnchors,
          missingSurfaces: scored.missingSurfaces,
          reasonsRejected: rejected,
        });
      }
      continue;
    }

    rows.push({
      operator: op,
      score: scored.score,
      reasons: scored.reasons,
      hardAnchors: scored.hardAnchors,
      missingSurfaces: scored.missingSurfaces,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  nearMisses.sort((a, b) => b.score - a.score);

  return {
    candidates: rows.slice(0, limit),
    nearMisses: nearMisses.slice(0, 25),
    candidateThreshold: minScore,
    candidateHardAnchorCount,
    skippedAlreadyEnriched,
    skippedSolaOnly,
    skippedCanonicalConflict,
    skippedMergedAway,
  };
}
