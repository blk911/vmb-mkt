import type {
  SocialActivityStatus,
  SocialDiscoverySource,
  SocialProfilePlatform,
  SocialResolveStatus,
  SocialVerificationStatus,
  SocialVisibilityState,
} from "@/types/social-target";

export const SOCIAL_PLATFORMS: SocialProfilePlatform[] = [
  "instagram",
  "tiktok",
  "website",
  "linktree",
  "unknown",
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
