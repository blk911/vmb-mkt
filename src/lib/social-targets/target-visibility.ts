import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { isConfirmedRealNoSocial } from "@/lib/social-targets/operator-rank";
import { getVerificationState } from "@/lib/social-targets/verification-state";
import type {
  SocialTarget,
  SocialResolveStatus,
  SocialVerificationStatus,
  VerificationState,
} from "@/types/social-target";

function primaryRow(t: SocialTarget) {
  return getPrimaryCandidate(ensureSocialCandidates(t));
}

export function getResolveStatus(t: SocialTarget): SocialResolveStatus {
  const integrity = getFeaturedValidationIntegrity(t);
  if (integrity.displayResolveState === "stale") return "unknown";
  return integrity.displayResolveState;
}

export function getVerificationStatus(t: SocialTarget): SocialVerificationStatus {
  const integrity = getFeaturedValidationIntegrity(t);
  if (integrity.displayVerificationState === "verify_needed") return "candidate";
  return integrity.displayVerificationState;
}

/** URL/handle resolves and responds as a real profile (not hard 404 / gone). */
export function isSocialProfileLive(t: SocialTarget): boolean {
  return getResolveStatus(t) === "live";
}

export function shouldHideTargetBecauseDead(t: SocialTarget): boolean {
  const p = primaryRow(t);
  const rs = p?.resolveStatus ?? getResolveStatus(t);
  if (rs === "dead") return true;
  if (p?.verificationStatus === "rejected" || t.socialProfile?.verificationStatus === "rejected") return true;
  if (p?.visibilityState === "hide" || t.socialProfile?.visibilityState === "hide") return true;
  return false;
}

/**
 * Primary operator list: actionable queue — no dead/rejected/hidden, no explicit review bucket,
 * and not “suppress-tier only” (all candidates &lt; 50 with no verified candidate).
 */
export function shouldShowTargetInPrimaryView(t: SocialTarget): boolean {
  if (shouldHideTargetBecauseDead(t)) return false;
  const p = primaryRow(t);
  if (p?.visibilityState === "review" || t.socialProfile?.visibilityState === "review") return false;
  if (isConfirmedRealNoSocial(t)) return true;
  return true;
}

/** Review queue: primary rejects + explicit review visibility (even if otherwise strong). */
export function shouldShowTargetInReviewView(t: SocialTarget): boolean {
  const p = primaryRow(t);
  const explicitReview =
    p?.visibilityState === "review" || t.socialProfile?.visibilityState === "review";
  return !shouldShowTargetInPrimaryView(t) || explicitReview;
}

export function isLiveVerified(t: SocialTarget): boolean {
  return getVerificationState(t) === "live_verified";
}

export function isDeadOrRejectedState(t: SocialTarget): boolean {
  const state = getVerificationState(t);
  return state === "dead" || state === "rejected";
}

export function isUnverifiedState(t: SocialTarget): boolean {
  const state: VerificationState = getVerificationState(t);
  return state === "unverified" || state === "matched" || state === "discovered";
}

/** Worth surfacing in “attack now” style KPIs (verified-enough + live resolve). */
export function isTargetActionable(t: SocialTarget): boolean {
  if (shouldHideTargetBecauseDead(t)) return false;
  return getVerificationState(t) === "live_verified";
}
