export type ImportDecisionStatus =
  | "unresolved"
  | "standalone"
  | "likely_duplicate"
  | "merge_candidate";

export type ComparisonTargetType = "admin_salon" | "imported_salon_record";

export interface MergeTargetSuggestion {
  targetId: string;
  targetType: ComparisonTargetType;
  businessName: string;
  score: number;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
  matchedFields: {
    businessName?: boolean;
    normalizedName?: boolean;
    bookingDomain?: boolean;
    instagramHandle?: boolean;
    phone?: boolean;
    address?: boolean;
    sourceUrl?: boolean;
  };
}

export interface DiffFieldChange {
  field: string;
  importedValue?: string | number | null;
  targetValue?: string | number | null;
  status: "same" | "different" | "missing_imported" | "missing_target";
}

export interface DiffSummary {
  importedEntityLabel: string;
  targetEntityLabel?: string;
  topSuggestion?: MergeTargetSuggestion;
  fieldChanges: DiffFieldChange[];
  warnings: string[];
}

export interface ComparableImportEntity {
  id: string;
  entityType: "imported_draft" | "imported_salon_record";
  businessName: string;
  sourceUrl?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  phone?: string;
  address?: string;
  serviceCount: number;
  providerCount: number;
  portfolioImageCount: number;
}

export interface ComparisonTargetEntity {
  id: string;
  targetType: ComparisonTargetType;
  businessName: string;
  sourceUrl?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  phone?: string;
  address?: string;
  serviceCount: number;
  providerCount: number;
  portfolioImageCount: number;
}

export interface MatchScoreResult {
  score: number;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
  matchedFields: MergeTargetSuggestion["matchedFields"];
}
