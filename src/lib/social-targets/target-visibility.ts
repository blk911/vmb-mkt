import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import { isConfirmedRealNoSocial, isPrimaryLowConfidenceOnly } from "@/lib/social-targets/operator-rank";
import { mapProfileHealthToResolveStatus } from "@/lib/social-targets/normalization";
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
  const p = primaryRow(t);
  return p?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
}

export function getVerificationStatus(t: SocialTarget): SocialVerificationStatus {
  const p = primaryRow(t);
  return p?.verificationStatus ?? t.socialProfile?.verificationStatus ?? "candidate";
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
  if (getResolveStatus(t) !== "live") return false;
  const vs = getVerificationStatus(t);
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
