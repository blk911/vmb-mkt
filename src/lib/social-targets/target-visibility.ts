import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { isConfirmedRealNoSocial, isPrimaryLowConfidenceOnly } from "@/lib/social-targets/operator-rank";
import type {
  SocialTarget,
  SocialResolveStatus,
  SocialVerificationStatus,
} from "@/types/social-target";

const CANDIDATE_CONFIDENCE_MIN = 50;

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
  if (isPrimaryLowConfidenceOnly(t)) return false;
  return true;
}

/** Review queue: primary rejects + explicit review visibility (even if otherwise strong). */
export function shouldShowTargetInReviewView(t: SocialTarget): boolean {
  const p = primaryRow(t);
  const explicitReview =
    p?.visibilityState === "review" || t.socialProfile?.visibilityState === "review";
  return !shouldShowTargetInPrimaryView(t) || explicitReview;
}

/** Worth surfacing in “attack now” style KPIs (verified-enough + live resolve). */
export function isTargetActionable(t: SocialTarget): boolean {
  if (shouldHideTargetBecauseDead(t)) return false;
  const integrity = getFeaturedValidationIntegrity(t);
  if (integrity.displayResolveState !== "live") return false;
  const vs = integrity.displayVerificationState === "verify_needed" ? "candidate" : integrity.displayVerificationState;
  if (vs === "rejected") return false;
  if (vs === "manual_verified" || vs === "auto_verified") return true;
  if (vs === "candidate") {
    const p = primaryRow(t);
    const mc = p?.overallConfidenceScore ?? t.socialProfile?.matchConfidence;
    if (mc == null) return true;
    return mc >= CANDIDATE_CONFIDENCE_MIN;
  }
  return false;
}
