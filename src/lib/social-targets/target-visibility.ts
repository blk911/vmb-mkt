import { mapProfileHealthToResolveStatus } from "@/lib/social-targets/normalization";
import type {
  SocialTarget,
  SocialResolveStatus,
  SocialVerificationStatus,
} from "@/types/social-target";

const CANDIDATE_CONFIDENCE_MIN = 50;

export function getResolveStatus(t: SocialTarget): SocialResolveStatus {
  return t.socialProfile?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
}

export function getVerificationStatus(t: SocialTarget): SocialVerificationStatus {
  return t.socialProfile?.verificationStatus ?? "candidate";
}

/** URL/handle resolves and responds as a real profile (not hard 404 / gone). */
export function isSocialProfileLive(t: SocialTarget): boolean {
  return getResolveStatus(t) === "live";
}

export function shouldHideTargetBecauseDead(t: SocialTarget): boolean {
  const rs = getResolveStatus(t);
  if (rs === "dead") return true;
  if (t.socialProfile?.verificationStatus === "rejected") return true;
  if (t.socialProfile?.visibilityState === "hide") return true;
  return false;
}

/**
 * Primary operator list: exclude dead/rejected/hidden and rows explicitly in review-only bucket.
 */
export function shouldShowTargetInPrimaryView(t: SocialTarget): boolean {
  if (shouldHideTargetBecauseDead(t)) return false;
  if (t.socialProfile?.visibilityState === "review") return false;
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
    const mc = t.socialProfile?.matchConfidence;
    if (mc == null) return true;
    return mc >= CANDIDATE_CONFIDENCE_MIN;
  }
  return false;
}
