export type SocialTargetStatus = "new" | "contacted" | "qualified" | "paused";

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
