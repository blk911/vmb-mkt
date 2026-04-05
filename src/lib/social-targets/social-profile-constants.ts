import type {
  SocialActivityStatus,
  SocialCandidateDiscoverySource,
  SocialDiscoverySource,
  SocialPlatform,
  SocialResolveStatus,
  SocialVerificationStatus,
  SocialVisibilityState,
} from "@/types/social-target";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "linktree",
  "website",
  "booking",
  "unknown",
];

export const SOCIAL_CANDIDATE_DISCOVERY_SOURCES: SocialCandidateDiscoverySource[] = [
  "seed",
  "maps",
  "website_scrape",
  "bio_link",
  "heuristic",
  "referral",
  "manual",
];

export const SOCIAL_DISCOVERY_SOURCES: SocialDiscoverySource[] = [
  "seed",
  "maps",
  "website_scrape",
  "heuristic",
  "manual",
  "referral",
];

export const SOCIAL_RESOLVE_STATUSES: SocialResolveStatus[] = ["live", "dead", "redirect", "blocked", "unknown"];

export const SOCIAL_ACTIVITY_STATUSES: SocialActivityStatus[] = ["recent", "stale", "unknown"];

export const SOCIAL_VERIFICATION_STATUSES: SocialVerificationStatus[] = [
  "manual_verified",
  "auto_verified",
  "candidate",
  "rejected",
];

export const SOCIAL_VISIBILITY_STATES: SocialVisibilityState[] = ["show", "review", "hide"];
