import type { ExternalSourceType } from "@/lib/external-site-capture/types";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";

export type ImportedSalonRecordStatus = "active" | "archived";

export interface ImportedSalonRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ImportedSalonRecordStatus;
  sourceDraftId: string;
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
  decisionStatus: ImportDecisionStatus;
  decisionUpdatedAt?: string;
}
