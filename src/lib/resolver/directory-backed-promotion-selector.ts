import type { ResolverOperator } from "./types";

export type DirectoryBackedPromotionCandidate = {
  operator: ResolverOperator;
  score: number;
  reasons: string[];
};

export type DirectoryBackedPromotionSelection = {
  candidates: DirectoryBackedPromotionCandidate[];
  skippedAlreadyEnriched: number;
  skippedSolaOnly: number;
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

function isSolaOnlyIdentity(op: ResolverOperator): boolean {
  if (!op.sources.length) return true;
  const nonSolaSources = op.sources.filter((row) => {
    const host = hostFromUrl(row.sourceUrl);
    return !isSolaHost(host);
  });
  return nonSolaSources.length === 0;
}

function uniqueSourceKinds(op: ResolverOperator): Set<string> {
  const kinds = new Set<string>();
  for (const row of op.sources) {
    kinds.add(row.source);
    if (row.evidenceType) kinds.add(row.evidenceType);
  }
  return kinds;
}

function hasDirectoryLikeEvidence(op: ResolverOperator): boolean {
  return op.sources.some((row) => {
    if (row.source === "directory" || row.source === "google") return true;
    return row.evidenceType === "directory_listing";
  });
}

export function selectDirectoryBackedPromotionCandidates(
  operators: ResolverOperator[],
  opts?: { limit?: number; minScore?: number }
): DirectoryBackedPromotionSelection {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 80));
  const minScore = opts?.minScore ?? 5;

  let skippedAlreadyEnriched = 0;
  let skippedSolaOnly = 0;
  const rows: DirectoryBackedPromotionCandidate[] = [];

  for (const op of operators) {
    if (op.status === "hot" || op.status === "enriched" || op.status === "ready") {
      skippedAlreadyEnriched += 1;
      continue;
    }
    if (op.status !== "enumerated") continue;
    if (op.isContainer) continue;
    if (!op.canonicalName || isProvisionalName(op.canonicalName)) continue;
    if (!op.canonicalCity && !op.canonicalAddress) continue;

    const solaOnly = isSolaOnlyIdentity(op);
    if (solaOnly) {
      skippedSolaOnly += 1;
      continue;
    }

    let score = 0;
    const reasons: string[] = [];
    const kinds = uniqueSourceKinds(op);
    const sourceCount = new Set(op.sources.map((row) => row.source)).size;
    const missingCount = [op.canonicalInstagram, op.canonicalBooking, op.canonicalWebsite].filter((v) => !v).length;

    if (op.canonicalWebsite || op.sources.some((row) => Boolean(row.website))) {
      score += 3;
      reasons.push("known domain evidence");
    }
    if (hasDirectoryLikeEvidence(op)) {
      score += 3;
      reasons.push("directory/place detail evidence");
    }
    if (op.canonicalPhone || op.sources.some((row) => Boolean(row.phone))) {
      score += 2;
      reasons.push("phone evidence");
    }
    if ((op.canonicalAddress && op.canonicalCity) || (op.canonicalAddress && op.sources.some((row) => row.city === op.canonicalCity))) {
      score += 2;
      reasons.push("address-city coherence");
    }
    if (sourceCount >= 2 || kinds.size >= 3) {
      score += 2;
      reasons.push("multi-source agreement");
    }
    if (missingCount === 1) {
      score += 2;
      reasons.push("one key surface missing");
    } else if (missingCount === 2) {
      score += 1;
      reasons.push("two key surfaces missing");
    }
    if (solaOnly) score -= 4;
    if (!op.canonicalName || isProvisionalName(op.canonicalName)) score -= 3;
    if (hasLikelyClosedSignal(op)) {
      score -= 3;
      reasons.push("likely closed/dead signal");
    }
    if (op.sources.length <= 1) score -= 2;

    if (!hasDirectoryLikeEvidence(op)) continue;
    if (!op.canonicalInstagram || !op.canonicalBooking || !op.canonicalWebsite) {
      // intended: target missing surfaces
    } else {
      continue;
    }
    if (score < minScore) continue;

    rows.push({ operator: op, score, reasons });
  }

  rows.sort((a, b) => b.score - a.score);
  return {
    candidates: rows.slice(0, limit),
    skippedAlreadyEnriched,
    skippedSolaOnly,
  };
}
