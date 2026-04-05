import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

export const FEATURED_VERIFICATION_FRESHNESS_DAYS = 7;
const FEATURED_VERIFICATION_FRESHNESS_MS = FEATURED_VERIFICATION_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

export type FeaturedDisplayResolveState = "live" | "dead" | "blocked" | "unknown" | "stale";
export type FeaturedDisplayVerificationState =
  | "manual_verified"
  | "auto_verified"
  | "candidate"
  | "rejected"
  | "verify_needed";

export type FeaturedValidationIntegrity = {
  featuredCandidateId?: string | null;
  displayCandidate?: SocialCandidate | null;
  displayResolveState: FeaturedDisplayResolveState;
  displayVerificationState: FeaturedDisplayVerificationState;
  displayActivityState: "recent" | "stale" | "unknown";
  isDisplaySafe: boolean;
  needsRecheck: boolean;
  reason: string;
};

function parseTs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return t;
}

function isFreshCheck(candidate: SocialCandidate): boolean {
  const ts = parseTs(candidate.lastCheckedAt) ?? parseTs(candidate.lastVerifiedAt);
  if (ts == null) return false;
  return Date.now() - ts <= FEATURED_VERIFICATION_FRESHNESS_MS;
}

function isInvalidFeaturedCandidate(c: SocialCandidate | null | undefined): boolean {
  if (!c) return true;
  if (c.verificationStatus === "rejected") return true;
  if (c.visibilityState === "hide") return true;
  if (c.resolveStatus === "dead") return true;
  return false;
}

function selectDisplayCandidate(target: SocialTarget): {
  featuredCandidateId?: string | null;
  displayCandidate: SocialCandidate | null;
  usedFallback: boolean;
} {
  const ensured = ensureSocialCandidates(target);
  const featuredId = ensured.primaryCandidateId ?? null;
  const featured = featuredId ? (ensured.socialCandidates ?? []).find((c) => c.id === featuredId) ?? null : null;

  if (!isInvalidFeaturedCandidate(featured)) {
    return { featuredCandidateId: featuredId, displayCandidate: featured, usedFallback: false };
  }

  const fallback = getPrimaryCandidate({ ...ensured, primaryCandidateId: undefined });
  if (fallback && !isInvalidFeaturedCandidate(fallback)) {
    return { featuredCandidateId: featuredId, displayCandidate: fallback, usedFallback: true };
  }

  return { featuredCandidateId: featuredId, displayCandidate: null, usedFallback: Boolean(featured) };
}

export function getFeaturedValidationIntegrity(target: SocialTarget): FeaturedValidationIntegrity {
  const { featuredCandidateId, displayCandidate, usedFallback } = selectDisplayCandidate(target);
  if (!displayCandidate) {
    return {
      featuredCandidateId,
      displayCandidate: null,
      displayResolveState: "unknown",
      displayVerificationState: "verify_needed",
      displayActivityState: "unknown",
      isDisplaySafe: false,
      needsRecheck: true,
      reason: "No current verified profile available",
    };
  }

  const fresh = isFreshCheck(displayCandidate);
  const verification = displayCandidate.verificationStatus;
  const resolve = displayCandidate.resolveStatus;

  if (resolve === "dead") {
    return {
      featuredCandidateId,
      displayCandidate,
      displayResolveState: "dead",
      displayVerificationState: verification === "rejected" ? "rejected" : "verify_needed",
      displayActivityState: "unknown",
      isDisplaySafe: false,
      needsRecheck: false,
      reason: "Previously verified profile no longer resolves",
    };
  }

  if (resolve === "blocked") {
    return {
      featuredCandidateId,
      displayCandidate,
      displayResolveState: "blocked",
      displayVerificationState: "verify_needed",
      displayActivityState: "unknown",
      isDisplaySafe: false,
      needsRecheck: true,
      reason: "Featured candidate blocked on last check; live status not confirmed",
    };
  }

  if (resolve !== "live") {
    return {
      featuredCandidateId,
      displayCandidate,
      displayResolveState: "unknown",
      displayVerificationState: verification === "rejected" ? "rejected" : "verify_needed",
      displayActivityState: displayCandidate.activityStatus ?? "unknown",
      isDisplaySafe: false,
      needsRecheck: true,
      reason: "Featured profile requires verification",
    };
  }

  if ((verification === "manual_verified" || verification === "auto_verified") && !fresh) {
    return {
      featuredCandidateId,
      displayCandidate,
      displayResolveState: "stale",
      displayVerificationState: "verify_needed",
      displayActivityState: "stale",
      isDisplaySafe: false,
      needsRecheck: true,
      reason: "Featured profile stale; recheck required",
    };
  }

  if (verification !== "manual_verified" && verification !== "auto_verified") {
    return {
      featuredCandidateId,
      displayCandidate,
      displayResolveState: "live",
      displayVerificationState: "candidate",
      displayActivityState: fresh && displayCandidate.activityStatus === "recent" ? "recent" : "unknown",
      isDisplaySafe: false,
      needsRecheck: true,
      reason: "Featured profile not yet verified",
    };
  }

  return {
    featuredCandidateId,
    displayCandidate,
    displayResolveState: "live",
    displayVerificationState: verification,
    displayActivityState: fresh && displayCandidate.activityStatus === "recent" ? "recent" : "unknown",
    isDisplaySafe: true,
    needsRecheck: false,
    reason: usedFallback ? "Featured candidate invalid; showing safer alternate" : "Featured profile verified and fresh",
  };
}

