export type BookingPlatform = "vagaro" | "glossgenius" | "booksy" | "fresha" | "square" | "unknown";
export type ProfileLinkKind = "directory" | "shared_business" | "individual" | "website" | "social" | "unknown";
export type ProfileRefinementStatus = "not_checked" | "directory_linked" | "provider_matched" | "shared_page_only" | "ambiguous" | "unmatched" | "blocked" | "unavailable" | "unsupported" | "error";

export interface ProfileLink {
  url: string;
  platform?: BookingPlatform;
  kind: ProfileLinkKind;
  attribution: "candidate" | "business" | "unresolved";
  sourceUrl: string;
  basis: "submitted" | "directory_card" | "linked_page";
  observedAt?: string;
  providerId?: string;
  businessId?: string;
}

export interface ProfileObservation {
  sourceUrl: string;
  finalUrl?: string;
  fetchedAt: string;
  outcome: "retrieved" | "blocked" | "unavailable" | "timeout" | "unsafe" | "unsupported" | "too_large" | "error";
  httpStatus?: number;
  contentHash?: string;
  claims: Array<{ type: "provider_business" | "platform" | "location" | "booking_url" | "social_url"; value: string }>;
}

/** A projection over source claims, never a license/ownership/manual-review decision. */
export interface CandidateProfile {
  schemaVersion: 1;
  providerName: string;
  platform: BookingPlatform;
  platformLabel: string;
  businessName?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  providerId?: string;
  businessId?: string;
  bookingLinks: ProfileLink[];
  socialLinks: ProfileLink[];
  websiteLinks: ProfileLink[];
  sourceContextUrl?: string;
  status: ProfileRefinementStatus;
  reasons: string[];
  observations: ProfileObservation[];
  lastAttemptAt?: string;
  lastSuccessfulAt?: string;
  nextAttemptAt?: string;
  searchStatus: "not_needed" | "unsupported";
  freshness: "source_reported" | "current_check" | "stale" | "unknown";
}

export interface ProfileRefinementRecord {
  schemaVersion: 1;
  reviewKey: string;
  fingerprint: string;
  runId: string;
  profile: CandidateProfile;
  completedAt: string;
}
