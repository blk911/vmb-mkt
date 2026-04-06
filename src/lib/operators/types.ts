export type PageClassification =
  | "direct_operator"
  | "directory_listing"
  | "suite_container"
  | "website"
  | "social_profile"
  | "unknown";

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
  source: "google" | "instagram" | "booking";
};

export type OperatorRecord = {
  id: string;
  name: string;
  city?: string;
  category?: string;
  sources: {
    google?: SourceRecord;
    instagram?: SourceRecord;
    booking?: SourceRecord;
  };
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
  confidenceScore: number;
  lastUpdatedAt: string;
  outreach?: {
    eligible?: boolean;
    reason?: "ok" | "needs_identity_cleanup" | "needs_surface_validation" | "needs_geo_cleanup";
    preferredChannel?: "instagram" | "booking" | "website" | "none";
  };
};
