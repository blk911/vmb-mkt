import type { SocialPlatform } from "@/types/social-target";

export type SourceType = "google_maps" | "yelp" | "dora" | "website";
export type SourceTrustTier = "tier1" | "tier2" | "tier3";
export type SourceLiveHint = "live" | "dead" | "unknown";

/**
 * Common normalized source candidate shape.
 * This is adapter output and does not imply identity truth.
 */
export type SourceCandidateInput = {
  sourceType: SourceType;
  sourceTrustTier: SourceTrustTier;
  sourceUrl?: string;
  sourceLabel?: string;
  businessName?: string;
  personName?: string;
  alternateNames?: string[];
  phone?: string;
  website?: string;
  domain?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  zone?: string;
  category?: string;
  subcategory?: string;
  platform?: SocialPlatform;
  handle?: string;
  profileUrl?: string;
  evidence?: string[];
  notes?: string[];
  anchorHint?: boolean;
  territoryHint?: boolean;
  liveHint?: SourceLiveHint;
  rawSourceId?: string;
  rawSourceType?: string;
};

