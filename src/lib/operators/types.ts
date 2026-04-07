export type PageClassification =
  | "direct_operator"
  | "directory_listing"
  | "suite_container"
  | "website"
  | "social_profile"
  | "unknown";

export type SourceKind = "dora" | "google" | "instagram" | "booking" | "directory" | "container" | "website";

export type SourceRecord = {
  name?: string;
  city?: string;
  category?: string;
  website?: string;
  phone?: string;
  instagram?: string;
  booking?: string;
  address?: string;
  sourceUrl?: string;
  extractedFromUrl?: string;
  parentContainerName?: string;
  evidenceType?: PageClassification;
  childQuerySeeds?: string[];
  raw?: unknown;
  extracted?: unknown;
  source: SourceKind;
};

export type OperatorRecord = {
  id: string;
  name: string;
  city?: string;
  category?: string;
  sources: Partial<Record<SourceKind, SourceRecord>>;
  evidence?: SourceRecord[];
  canonical: {
    instagram?: string;
    booking?: string;
    website?: string;
    phone?: string;
  };
  validation: {
    instagramStatus: "valid" | "dead" | "missing";
    bookingStatus: "valid" | "dead" | "missing";
    websiteStatus: "valid" | "dead" | "missing";
  };
  status: "hot" | "shelved" | "discard";
  reviewState?: "unreviewed" | "ready" | "shelved_by_review";
  reviewNotes?: string;
  preferredContactSurface?: "booking" | "instagram" | "website" | "phone" | "none";
  normalizedCategory?: "nails" | "lashes" | "brows" | "hair" | "spa" | "multi_service" | "unknown";
  businessType?: "solo_tech" | "salon" | "suite_based" | "unknown";
  contactPriority?: "high" | "medium" | "low";
  readyBatchTag?: string;
  confidenceScore: number;
  lastUpdatedAt: string;
  outreach?: {
    eligible?: boolean;
    reason?: "ok" | "needs_identity_cleanup" | "needs_surface_validation" | "needs_geo_cleanup";
    preferredChannel?: "instagram" | "booking" | "website" | "none";
  };
};
