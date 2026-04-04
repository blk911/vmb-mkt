export type SocialTargetStatus = "new" | "contacted" | "qualified" | "paused" | "responded" | "live";

export type ProfileHealth = "active" | "not_found" | "renamed_or_moved" | "stale" | "private" | "unknown";

export type ActivitySignal = "hot" | "warm" | "cold" | "unknown";

export type SocialTargetBooking = "dm" | "link" | "phone";

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
