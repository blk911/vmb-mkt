export type SocialTargetStatus = "new" | "contacted" | "qualified" | "paused" | "responded" | "live";

export type ProfileHealth = "active" | "not_found" | "renamed_or_moved" | "stale" | "private" | "unknown";

export type ActivitySignal = "hot" | "warm" | "cold" | "unknown";

export type SocialTargetBooking = "dm" | "link" | "phone";

/** Platforms for social candidates (v3). */
export type SocialPlatform = "instagram" | "tiktok" | "linktree" | "website" | "booking" | "unknown";

/** @deprecated Use SocialPlatform — kept for older `socialProfile` fields. */
export type SocialProfilePlatform = SocialPlatform;

export type SocialDiscoverySource = "seed" | "maps" | "website_scrape" | "heuristic" | "manual" | "referral";

export type SocialCandidateDiscoverySource =
  | "seed"
  | "maps"
  | "website_scrape"
  | "bio_link"
  | "heuristic"
  | "referral"
  | "manual";

export type SocialResolveStatus = "live" | "dead" | "redirect" | "blocked" | "unknown";

export type SocialActivityStatus = "recent" | "stale" | "unknown";

export type SocialVerificationStatus = "manual_verified" | "auto_verified" | "candidate" | "rejected";

export type SocialVisibilityState = "show" | "review" | "hide";

/** One discoverable social identity attached to a target (v3). */
export type SocialCandidate = {
  id: string;
  platform: SocialPlatform;
  url?: string;
  handle?: string;
  discoverySource: SocialCandidateDiscoverySource;
  resolveStatus: SocialResolveStatus;
  activityStatus: SocialActivityStatus;
  verificationStatus: SocialVerificationStatus;
  businessMatchScore: number;
  geoMatchScore: number;
  categoryMatchScore: number;
  activityScore: number;
  overallConfidenceScore: number;
  lastCheckedAt?: string | null;
  lastVerifiedAt?: string | null;
  notes?: string;
  evidence?: string[];
  visibilityState?: SocialVisibilityState;
};

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
  booking?: SocialTargetBooking;
  followers?: number;
  profileHealth?: ProfileHealth;
  lastVerifiedAt?: string;
  verificationNote?: string;
  activitySignal?: ActivitySignal;
  priorityScore?: number;
  priorityScoreManual?: boolean;
  outreachAngle?: string;
  /** Legacy single-profile bag; synced from primary candidate when possible. */
  socialProfile?: SocialTargetSocialProfile;
  /** v3: multiple social identities per target. */
  socialCandidates?: SocialCandidate[];
  /** v3: operator-selected featured candidate; if unset, derived automatically. */
  primaryCandidateId?: string;
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
