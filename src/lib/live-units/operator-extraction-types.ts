/**
 * Validated operator extraction — business-anchored, tier-gated (v1: Tier A surfaces only).
 */

export type OperatorSourceType =
  | "website_staff_page"
  | "website_provider_page"
  | "instagram_business_bio"
  | "instagram_business_post"
  | "instagram_cross_link"
  | "other";

export type OperatorConfidence = "high" | "medium" | "low";

export interface ExtractedOperatorCandidate {
  id: string;
  businessId: string;
  businessName: string | null;
  locationLabel: string | null;
  operatorName: string | null;
  roleLabel: string | null;
  instagramHandle: string | null;
  profileUrl: string | null;
  sourceTypes: OperatorSourceType[];
  evidenceSnippets: string[];
  confidence: OperatorConfidence;
  isSurfaced: boolean;
  lastSeenAt: string | null;
}

export interface SurfacedOperator {
  id: string;
  businessId: string;
  operatorName: string;
  roleLabel: string | null;
  instagramHandle: string | null;
  profileUrl: string | null;
  sourceTypes: OperatorSourceType[];
  evidenceSnippets: string[];
  confidence: "high";
  lastSeenAt: string | null;
}
