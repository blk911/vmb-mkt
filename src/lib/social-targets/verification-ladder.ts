import type { SocialCandidate, SocialTarget } from "@/types/social-target";
import type { SocialVerificationResult } from "@/lib/social-targets/social-verification";

export const REVALIDATION_FRESH_DAYS = 7;
export const REVALIDATION_TRUST_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CandidateVerificationLadderResult = {
  resolveState: "live" | "dead" | "blocked" | "redirect" | "unknown";
  identityMatchState: "strong" | "plausible" | "weak" | "mismatch" | "unknown";
  territoryState: "in_territory" | "out_of_territory" | "ambiguous" | "unknown";
  activityState: "recent" | "stale" | "inactive" | "unknown";
  featuredDecision: "keep_featured" | "replace_if_better_alternate_exists" | "review" | "demote" | "suppress";
  confidenceScore: number;
  reasons: string[];
  checkedAt: string;
};

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function parseTs(iso?: string | null): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function verificationAgeDays(candidate: SocialCandidate, nowMs = Date.now()): number | null {
  const ts = parseTs(candidate.lastCheckedAt) ?? parseTs(candidate.lastVerifiedAt);
  if (ts == null) return null;
  return Math.max(0, (nowMs - ts) / DAY_MS);
}

export function isCandidateStaleForRevalidation(candidate: SocialCandidate, nowMs = Date.now()): boolean {
  const age = verificationAgeDays(candidate, nowMs);
  return age != null && age > REVALIDATION_FRESH_DAYS;
}

function normalizeResolveState(
  candidate: SocialCandidate,
  verification?: SocialVerificationResult
): CandidateVerificationLadderResult["resolveState"] {
  const resolve = verification?.resolveStatus ?? candidate.resolveStatus;
  if (resolve === "live" || resolve === "dead" || resolve === "blocked" || resolve === "redirect") return resolve;
  return "unknown";
}

function normalizeActivityState(
  candidate: SocialCandidate,
  resolveState: CandidateVerificationLadderResult["resolveState"],
  verification?: SocialVerificationResult
): CandidateVerificationLadderResult["activityState"] {
  if (resolveState === "dead") return "inactive";
  const activity = verification?.activityStatus ?? candidate.activityStatus ?? "unknown";
  if (activity === "recent") return "recent";
  if (activity === "stale") return "stale";
  return "unknown";
}

function normalizeIdentityMatchState(target: SocialTarget, candidate: SocialCandidate): CandidateVerificationLadderResult["identityMatchState"] {
  const businessScore = candidate.businessMatchScore ?? 0;
  const categoryScore = candidate.categoryMatchScore ?? 0;
  const handle = (candidate.handle ?? "").toLowerCase();
  const business = (target.businessName ?? "").toLowerCase();
  const handleHint = business
    ? business
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 6)
    : "";
  const handleLooksRelated = Boolean(handleHint) && handle.replace(/[^a-z0-9]+/g, "").includes(handleHint);

  if (businessScore >= 80 && categoryScore >= 60) return "strong";
  if (businessScore >= 60 || (categoryScore >= 50 && handleLooksRelated)) return "plausible";
  if (businessScore <= 15 && categoryScore <= 15 && !handleLooksRelated) return "mismatch";
  if (businessScore > 0 || categoryScore > 0 || handleLooksRelated) return "weak";
  return "unknown";
}

function normalizeTerritoryState(candidate: SocialCandidate): CandidateVerificationLadderResult["territoryState"] {
  const geo = candidate.geoMatchScore ?? 0;
  if (geo >= 70) return "in_territory";
  if (geo > 0 && geo <= 20) return "out_of_territory";
  if (geo > 20 && geo < 70) return "ambiguous";
  return "unknown";
}

function hasBetterAlternate(
  currentCandidateId: string,
  alternatives: SocialCandidate[],
  currentConfidence: number
): boolean {
  return alternatives.some((alt) => {
    if (alt.id === currentCandidateId) return false;
    if (alt.visibilityState === "hide" || alt.verificationStatus === "rejected") return false;
    if (alt.resolveStatus !== "live") return false;
    return (alt.overallConfidenceScore ?? 0) > currentConfidence + 5;
  });
}

export function evaluateCandidateVerificationLadder(
  target: SocialTarget,
  candidate: SocialCandidate,
  options?: {
    verification?: SocialVerificationResult;
    alternatives?: SocialCandidate[];
    nowMs?: number;
    asFeatured?: boolean;
  }
): CandidateVerificationLadderResult {
  const nowMs = options?.nowMs ?? Date.now();
  const resolveState = normalizeResolveState(candidate, options?.verification);
  const identityMatchState = normalizeIdentityMatchState(target, candidate);
  const territoryState = normalizeTerritoryState(candidate);
  const activityState = normalizeActivityState(candidate, resolveState, options?.verification);
  const ageDays = verificationAgeDays(candidate, nowMs);
  const stale = ageDays != null && ageDays > REVALIDATION_FRESH_DAYS;
  const trustExpired = ageDays != null && ageDays > REVALIDATION_TRUST_MAX_DAYS;
  const reasons: string[] = [];

  if (resolveState === "dead") reasons.push("Profile no longer resolves");
  if (resolveState === "blocked") reasons.push("Blocked by platform; status unknown");
  if (resolveState === "redirect") reasons.push("Profile redirects; identity requires reconfirmation");
  if (identityMatchState === "mismatch") reasons.push("Identity mismatch against anchor");
  else if (identityMatchState === "weak") reasons.push("Handle/profile weakly tied to anchor");
  if (territoryState === "out_of_territory") reasons.push("Out-of-territory same-name risk");
  else if (territoryState === "ambiguous") reasons.push("Territory ambiguous; requires operator review");
  if (stale) reasons.push("Stale verification older than freshness threshold");
  if (trustExpired) reasons.push("Verification older than trust window; cannot remain trusted live truth");
  if (activityState === "inactive") reasons.push("Profile inactive/non-operational");

  const baseConfidence = candidate.overallConfidenceScore ?? 0;
  const confidenceScore = clampInt(
    baseConfidence +
      (identityMatchState === "strong" ? 12 : identityMatchState === "plausible" ? 6 : identityMatchState === "mismatch" ? -18 : -4) +
      (territoryState === "in_territory" ? 10 : territoryState === "out_of_territory" ? -20 : territoryState === "ambiguous" ? -8 : -2) +
      (resolveState === "live" ? 8 : resolveState === "dead" ? -25 : resolveState === "blocked" ? -12 : resolveState === "redirect" ? -8 : -6) +
      (trustExpired ? -18 : stale ? -8 : 4),
    0,
    100
  );

  let featuredDecision: CandidateVerificationLadderResult["featuredDecision"] = "review";
  const betterAlt = hasBetterAlternate(candidate.id, options?.alternatives ?? [], candidate.overallConfidenceScore ?? 0);
  if (resolveState === "dead" || identityMatchState === "mismatch" || territoryState === "out_of_territory") {
    featuredDecision = "suppress";
  } else if (resolveState === "blocked" || resolveState === "unknown") {
    featuredDecision = "review";
  } else if (resolveState === "redirect") {
    featuredDecision = betterAlt ? "replace_if_better_alternate_exists" : "review";
  } else if (trustExpired || activityState === "inactive") {
    featuredDecision = betterAlt ? "replace_if_better_alternate_exists" : "demote";
  } else if (stale) {
    featuredDecision = betterAlt ? "replace_if_better_alternate_exists" : "review";
  } else if (resolveState === "live" && (identityMatchState === "strong" || identityMatchState === "plausible")) {
    featuredDecision = "keep_featured";
  }

  if (options?.asFeatured && featuredDecision === "keep_featured" && betterAlt) {
    featuredDecision = "replace_if_better_alternate_exists";
    reasons.push("Better verified alternate exists");
  }

  return {
    resolveState,
    identityMatchState,
    territoryState,
    activityState,
    featuredDecision,
    confidenceScore,
    reasons,
    checkedAt: options?.verification?.lastCheckedAt ?? new Date(nowMs).toISOString(),
  };
}

export function pickBestFeaturedReplacement(
  target: SocialTarget,
  candidates: SocialCandidate[],
  nowMs = Date.now()
): string | null {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      ladder: evaluateCandidateVerificationLadder(target, candidate, {
        alternatives: candidates,
        nowMs,
        asFeatured: false,
      }),
    }))
    .filter(({ candidate, ladder }) => {
      if (candidate.visibilityState === "hide" || candidate.verificationStatus === "rejected") return false;
      if (ladder.resolveState !== "live") return false;
      if (ladder.identityMatchState === "mismatch") return false;
      if (ladder.territoryState === "out_of_territory") return false;
      if (ladder.featuredDecision === "suppress") return false;
      return ladder.confidenceScore >= 55;
    })
    .sort((a, b) => b.ladder.confidenceScore - a.ladder.confidenceScore);

  return ranked[0]?.candidate.id ?? null;
}
