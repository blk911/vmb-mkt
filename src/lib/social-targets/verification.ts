/**
 * @deprecated Import from `social-normalization` / `social-verification` instead.
 * Barrel kept for older import paths.
 */
export { VERIFICATION_ALLOWED_HOSTS, detectPlatformFromUrl, normalizeSocialUrl } from "@/lib/social-targets/social-normalization";
export {
  classifyHttpResult,
  verifyInstagramCandidate,
  verifyLinktreeCandidate,
  verifySocialCandidate,
  verifyTikTokCandidate,
  verifyUrlHead,
  verifyWebsiteCandidate,
} from "@/lib/social-targets/social-verification";
export type { SocialVerificationResult } from "@/lib/social-targets/social-verification";
