import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
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
 * Primary operator list: exclude dead/rejected/hidden and rows explicitly in review-only bucket.
 */
export function shouldShowTargetInPrimaryView(t: SocialTarget): boolean {
  if (shouldHideTargetBecauseDead(t)) return false;
  const p = primaryRow(t);
  if (p?.visibilityState === "review" || t.socialProfile?.visibilityState === "review") return false;
  return true;
}

/** Review queue: everything not suitable for default primary, plus explicit review flag. */
export function shouldShowTargetInReviewView(t: SocialTarget): boolean {
  return !shouldShowTargetInPrimaryView(t) || t.socialProfile?.visibilityState === "review";
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
