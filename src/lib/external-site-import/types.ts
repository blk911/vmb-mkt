import type { ExternalSourceType } from "@/lib/external-site-capture/types";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";
import type { ImportedProfileReviewState } from "@/lib/external-site-review/types";

export type ImportedProfileDraftStatus = "draft" | "reviewed" | "ready" | "rejected";

export interface ImportedProfileDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ImportedProfileDraftStatus;
  sourceType: ExternalSourceType;
  sourceUrl: string;
  businessName: string;
  subtitle?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  heroImageUrl?: string;
  services: Array<{
    id: string;
    title: string;
    subtitle?: string;
    priceLabel?: string;
    durationLabel?: string;
    imageUrl?: string;
  }>;
  providers: Array<{
    id: string;
    name: string;
    title?: string;
    imageUrl?: string;
  }>;
  portfolioImages: string[];
  referralBlock: {
    headline: string;
    body: string;
  };
  giftBlock: {
    headline: string;
    body: string;
  };
  networkBlock: {
    headline: string;
    body: string;
  };
  diagnostics: string[];
  parseConfidence: "High" | "Medium" | "Low";
  sourceSnapshotId?: string;
  decisionStatus: ImportDecisionStatus;
  decisionUpdatedAt?: string;
  review: ImportedProfileReviewState;
}
