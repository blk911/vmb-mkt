import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import { mapProfileHealthToResolveStatus } from "@/lib/social-targets/normalization";
import { confidenceTier } from "@/lib/social-targets/social-scoring";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

/** High-level bucket for operator scanning (derived, not persisted). */
export type PrimaryOperationalState =
  | "verified_live"
  | "live_usable"
  | "live_review"
  | "not_live"
  | "dead_or_suppressed";

const SUPPRESS_THRESHOLD = 50;

function primaryCandidate(t: SocialTarget): SocialCandidate | null {
  return getPrimaryCandidate(ensureSocialCandidates(t));
}

function activityRank(signal: SocialCandidate["activityStatus"]): number {
  switch (signal) {
    case "recent":
      return 3;
    case "unknown":
      return 2;
    case "stale":
      return 1;
    default:
      return 0;
  }
}

function resolveRank(rs: SocialCandidate["resolveStatus"]): number {
  switch (rs) {
    case "live":
      return 5;
    case "redirect":
      return 4;
    case "unknown":
      return 3;
    case "blocked":
      return 2;
    case "dead":
      return 0;
    default:
      return 1;
  }
}

function verificationRank(vs: SocialCandidate["verificationStatus"]): number {
  switch (vs) {
    case "manual_verified":
      return 4;
    case "auto_verified":
      return 3;
    case "candidate":
      return 2;
    case "rejected":
      return 0;
    default:
      return 1;
  }
}

function tierRank(score: number): number {
  const t = confidenceTier(score);
  switch (t) {
    case "high":
      return 4;
    case "usable":
      return 3;
    case "review":
      return 2;
    case "suppress":
      return 1;
  }
}

export function getPrimaryOperationalState(t: SocialTarget): PrimaryOperationalState {
  const p = primaryCandidate(t);
  const rs = p?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
  if (rs === "dead" || p?.verificationStatus === "rejected" || p?.visibilityState === "hide") {
    return "dead_or_suppressed";
  }
  const vs = p?.verificationStatus ?? "candidate";
  if (rs !== "live") return "not_live";
  if (vs === "manual_verified" || vs === "auto_verified") return "verified_live";
  const score = p?.overallConfidenceScore ?? 0;
  if (score >= SUPPRESS_THRESHOLD) return "live_usable";
  return "live_review";
}

export type OperatorRankParts = {
  /** Composite sort key: higher = more valuable in default queue. */
  rank: number;
  verificationRank: number;
  resolveRank: number;
  tierRank: number;
  activityRank: number;
  priorityScore: number;
  followers: number;
};

/**
 * Explainable display rank: verification and resolve dominate; followers are a weak tie-breaker
 * so high-follower junk does not float above verified live rows.
 */
export function computeOperatorDisplayRank(t: SocialTarget): OperatorRankParts {
  const p = primaryCandidate(t);
  const rs = p?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
  const vs = p?.verificationStatus ?? "candidate";
  const vr = verificationRank(vs);
  const rr = resolveRank(rs);
  const tr = tierRank(p?.overallConfidenceScore ?? 0);
  const ar = activityRank(p?.activityStatus ?? "unknown");
  const prio = t.priorityScore ?? 0;
  const fol = typeof t.followers === "number" && t.followers >= 0 ? t.followers : 0;

  const rank =
    vr * 1_000_000_000 +
    rr * 100_000_000 +
    tr * 10_000_000 +
    ar * 1_000_000 +
    prio * 1_000 +
    Math.min(fol, 999);

  return {
    rank,
    verificationRank: vr,
    resolveRank: rr,
    tierRank: tr,
    activityRank: ar,
    priorityScore: prio,
    followers: fol,
  };
}

export function compareTargetsByOperatorRank(a: SocialTarget, b: SocialTarget, desc: boolean): number {
  const ra = computeOperatorDisplayRank(a).rank;
  const rb = computeOperatorDisplayRank(b).rank;
  if (ra !== rb) return desc ? rb - ra : ra - rb;
  return a.id.localeCompare(b.id);
}

/** Best non-rejected, non-hidden candidate to feature: verified live first, then by confidence. */
export function pickBestFeaturedCandidateId(t: SocialTarget): string | undefined {
  const ensured = ensureSocialCandidates(t);
  const list = (ensured.socialCandidates ?? []).filter(
    (c) => c.verificationStatus !== "rejected" && c.visibilityState !== "hide"
  );
  if (!list.length) return undefined;

  const verifiedLive = list.filter(
    (c) =>
      c.resolveStatus === "live" &&
      (c.verificationStatus === "manual_verified" || c.verificationStatus === "auto_verified")
  );
  const pool = verifiedLive.length ? verifiedLive : list.filter((c) => c.resolveStatus === "live");
  const sortPool = (pool.length ? pool : list).slice();
  sortPool.sort((a, b) => b.overallConfidenceScore - a.overallConfidenceScore);
  return sortPool[0]?.id;
}

/** True when every non-rejected/non-hidden candidate is below suppress threshold and none are verified. */
export function isPrimaryLowConfidenceOnly(t: SocialTarget): boolean {
  const ensured = ensureSocialCandidates(t);
  const list = (ensured.socialCandidates ?? []).filter(
    (c) => c.verificationStatus !== "rejected" && c.visibilityState !== "hide"
  );
  if (!list.length) return true;
  if (
    list.some(
      (c) => c.verificationStatus === "manual_verified" || c.verificationStatus === "auto_verified"
    )
  ) {
    return false;
  }
  const best = Math.max(...list.map((c) => c.overallConfidenceScore));
  return best < SUPPRESS_THRESHOLD;
}

/**
 * Featured candidate confidence vs best alternate (excluding featured id): flag when a stronger alternate exists.
 */
export function featuredWeakerThanBestAlternate(t: SocialTarget): boolean {
  const ensured = ensureSocialCandidates(t);
  const featured = getPrimaryCandidate(ensured);
  const list = (ensured.socialCandidates ?? []).filter(
    (c) => c.verificationStatus !== "rejected" && c.visibilityState !== "hide"
  );
  if (!featured || list.length < 2) return false;
  const others = list.filter((c) => c.id !== featured.id);
  if (!others.length) return false;
  const bestOther = Math.max(...others.map((c) => c.overallConfidenceScore));
  return bestOther > featured.overallConfidenceScore + 5;
}
