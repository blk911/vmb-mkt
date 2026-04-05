import type { SocialCandidate, SocialCandidateDiscoverySource, SocialTarget } from "@/types/social-target";
import type { SocialVerificationResult } from "@/lib/social-targets/social-verification";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

/** Heuristic overlap between business name and handle / candidate handle. */
export function scoreBusinessMatch(candidate: SocialCandidate, target: SocialTarget): number {
  const biz = target.businessName?.trim();
  if (!biz) return 45;
  const h = (candidate.handle ?? target.handle).replace(/^@/, "").toLowerCase();
  const b = biz.toLowerCase();
  if (b.includes(h) || h.includes(b.replace(/\s/g, ""))) return 88;
  const bt = tokenize(biz);
  const ht = tokenize(h.replace(/[._-]/g, " "));
  let overlap = 0;
  for (const x of ht) {
    if (bt.has(x)) overlap++;
  }
  if (overlap >= 2) return 78;
  if (overlap === 1) return 62;
  return 38;
}

/** Zone string overlap (weak MVP). */
export function scoreGeoMatch(candidate: SocialCandidate, target: SocialTarget): number {
  const z = target.zone.toLowerCase().replace(/-/g, " ");
  const hint = (candidate.notes ?? "").toLowerCase();
  if (hint && z.split(/\s+/).some((w) => w.length > 2 && hint.includes(w))) return 72;
  return 55;
}

export function scoreCategoryMatch(candidate: SocialCandidate, target: SocialTarget): number {
  const c = target.category.toLowerCase();
  const p = candidate.platform;
  if (c.includes("nail") && p === "instagram") return 70;
  if (c.includes("hair") && p === "instagram") return 68;
  return 58;
}

export function scoreActivityFromVerification(v: SocialVerificationResult): number {
  switch (v.activityStatus) {
    case "recent":
      return 80;
    case "stale":
      return 45;
    default:
      return v.resolveStatus === "live" ? 55 : 35;
  }
}

export function scoreDiscoveryTrust(source: SocialCandidateDiscoverySource): number {
  switch (source) {
    case "manual":
    case "maps":
      return 90;
    case "seed":
      return 75;
    case "referral":
      return 68;
    case "website_scrape":
    case "bio_link":
      return 62;
    case "heuristic":
      return 48;
    default:
      return 50;
  }
}

/** Map resolve status to 0–100 validity contribution. */
export function scoreResolveValidity(resolveStatus: SocialCandidate["resolveStatus"]): number {
  switch (resolveStatus) {
    case "live":
      return 100;
    case "redirect":
      return 55;
    case "blocked":
      return 40;
    case "unknown":
      return 42;
    case "dead":
      return 0;
    default:
      return 40;
  }
}

const W_RESOLVE = 0.25;
const W_BUSINESS = 0.25;
const W_GEO = 0.2;
const W_CATEGORY = 0.15;
const W_ACTIVITY = 0.1;
const W_DISCOVERY = 0.05;

export function scoreOverallConfidence(parts: {
  resolveScore: number;
  businessScore: number;
  geoScore: number;
  categoryScore: number;
  activityScore: number;
  discoveryScore: number;
}): number {
  const raw =
    parts.resolveScore * W_RESOLVE +
    parts.businessScore * W_BUSINESS +
    parts.geoScore * W_GEO +
    parts.categoryScore * W_CATEGORY +
    parts.activityScore * W_ACTIVITY +
    parts.discoveryScore * W_DISCOVERY;
  return clamp(raw);
}

export function recomputeCandidateScores(
  candidate: SocialCandidate,
  target: SocialTarget,
  verification?: SocialVerificationResult
): SocialCandidate {
  const resolveScore = scoreResolveValidity(candidate.resolveStatus);
  const businessScore = scoreBusinessMatch(candidate, target);
  const geoScore = scoreGeoMatch(candidate, target);
  const categoryScore = scoreCategoryMatch(candidate, target);
  const activityScore = verification
    ? scoreActivityFromVerification(verification)
    : candidate.activityStatus === "recent"
      ? 75
      : candidate.activityStatus === "stale"
        ? 40
        : 45;
  const discoveryScore = scoreDiscoveryTrust(candidate.discoverySource);
  const overallConfidenceScore = scoreOverallConfidence({
    resolveScore,
    businessScore,
    geoScore,
    categoryScore,
    activityScore,
    discoveryScore,
  });
  return {
    ...candidate,
    businessMatchScore: businessScore,
    geoMatchScore: geoScore,
    categoryMatchScore: categoryScore,
    activityScore,
    overallConfidenceScore,
  };
}

export function confidenceTier(score: number): "high" | "usable" | "review" | "suppress" {
  if (score >= 85) return "high";
  if (score >= 70) return "usable";
  if (score >= 50) return "review";
  return "suppress";
}
