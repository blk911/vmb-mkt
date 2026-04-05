import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import type { SocialTarget, VerificationState } from "@/types/social-target";

const VALID_STATES: VerificationState[] = [
  "discovered",
  "matched",
  "unverified",
  "live_verified",
  "dead",
  "rejected",
];

function isVerificationState(value: unknown): value is VerificationState {
  return typeof value === "string" && VALID_STATES.includes(value as VerificationState);
}

export function deriveVerificationState(target: SocialTarget): VerificationState {
  const integrity = getFeaturedValidationIntegrity(target);
  const primary = integrity.displayCandidate ?? getPrimaryCandidate(ensureSocialCandidates(target));
  if (primary?.verificationStatus === "rejected" || primary?.visibilityState === "hide") return "rejected";
  if (integrity.displayResolveState === "dead") return "dead";
  if (
    integrity.displayResolveState === "live" &&
    (integrity.displayVerificationState === "manual_verified" || integrity.displayVerificationState === "auto_verified") &&
    integrity.isDisplaySafe
  ) {
    return "live_verified";
  }
  const hasAnySignal = Boolean(primary) || (target.evidence?.length ?? 0) > 0 || (target.socialCandidates?.length ?? 0) > 0;
  const hasCheckedAt = Boolean(primary?.lastCheckedAt || primary?.lastVerifiedAt || target.lastVerifiedAt);
  if (hasAnySignal && !hasCheckedAt) return "unverified";
  const matchScore = primary?.overallConfidenceScore ?? target.confidenceScore ?? 0;
  if (matchScore >= 60 || (target.evidence?.length ?? 0) >= 2) return "matched";
  return "discovered";
}

export function getVerificationState(target: SocialTarget): VerificationState {
  if (isVerificationState(target.verificationState)) return target.verificationState;
  return deriveVerificationState(target);
}

export function withNormalizedVerificationState(target: SocialTarget): SocialTarget {
  return {
    ...target,
    verificationState: deriveVerificationState(target),
  };
}

export function isLiveVerifiedState(state: VerificationState): boolean {
  return state === "live_verified";
}
