export type SocialTargetStatus = "new" | "contacted" | "qualified" | "paused" | "responded" | "live";

export type ProfileHealth = "active" | "not_found" | "renamed_or_moved" | "stale" | "private" | "unknown";

export type ActivitySignal = "hot" | "warm" | "cold" | "unknown";

export type SocialTargetBooking = "dm" | "link" | "phone";

/** Optional structured social identity + verification (v2). Legacy `profileHealth` / `handle` still supported. */
export type SocialProfilePlatform = "instagram" | "tiktok" | "website" | "linktree" | "unknown";

export type SocialDiscoverySource = "seed" | "maps" | "website_scrape" | "heuristic" | "manual" | "referral";

export type SocialResolveStatus = "live" | "dead" | "redirect" | "blocked" | "unknown";

export type SocialActivityStatus = "recent" | "stale" | "unknown";

export type SocialVerificationStatus = "manual_verified" | "auto_verified" | "candidate" | "rejected";

export type SocialVisibilityState = "show" | "review" | "hide";

export type SocialTargetSocialProfile = {
  platform?: SocialProfilePlatform;
  url?: string;
  handle?: string;
  discoverySource?: SocialDiscoverySource;
  resolveStatus?: SocialResolveStatus;
  activityStatus?: SocialActivityStatus;
  verificationStatus?: SocialVerificationStatus;
  matchConfidence?: number;
  geoConfidence?: number;
  categoryConfidence?: number;
  lastCheckedAt?: string | null;
  lastVerifiedAt?: string | null;
  visibilityState?: SocialVisibilityState;
};

export type SocialTarget = {
  id: string;
  handle: string;
  businessName?: string;
  zone: string;
  category: string;
  tags?: string[];
  status?: SocialTargetStatus;
  notes?: string;
  referralCount?: number;
  referredByCount?: number;
  isReferralHub?: boolean;
  /** DM / link-in-bio / phone CTA — used in priority scoring */
  booking?: SocialTargetBooking;
  followers?: number;
  profileHealth?: ProfileHealth;
  lastVerifiedAt?: string;
  verificationNote?: string;
  activitySignal?: ActivitySignal;
  priorityScore?: number;
  /** When true, `priorityScore` is operator-set; health/activity edits auto-recompute when false/undefined */
  priorityScoreManual?: boolean;
  outreachAngle?: string;
  /** Structured verification / platform metadata (optional; merged with legacy fields when absent). */
  socialProfile?: SocialTargetSocialProfile;
};

export type ReferralCategory = "nails" | "hair" | "lashes" | "brows" | "spa" | "other";
export type ReferralConfidence = "single" | "multi";

export type ReferralEdge = {
  id: string;
  fromTargetId: string;
  fromHandle: string;
  toHandle: string;
  toTargetId?: string;
  referredCategory: ReferralCategory;
  confidence: ReferralConfidence;
  timesSeen: number;
  note?: string;
  createdAt: string;
};
