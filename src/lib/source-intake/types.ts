export type SourceType =
  | "scheduler_roster"
  | "team_page"
  | "booking_menu"
  | "suite_directory"
  | "instagram_bio"
  | "linktree"
  | "marketplace_listing"
  | "manual_field_note";

export type SourceIntakeStatus =
  | "pending"
  | "parsed"
  | "processed"
  | "failed";

export type MatchDisposition =
  | "matched"
  | "possible_match"
  | "new_candidate"
  | "held";

export type ParseConfidence = "high" | "medium" | "low";

export type SourceIntakeRecord = {
  id: string;
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  notes?: string;
  rawText: string;
  status: SourceIntakeStatus;
  submittedAt: string;
  submittedBy?: string;
  parseSummary?: {
    totalCandidates: number;
    parsedAt: string;
  };
  processSummary?: {
    processedAt: string;
    evidenceCreated: number;
    matchedCount: number;
    newCandidateCount: number;
    heldCount: number;
  };
};

export type ParsedCandidateRow = {
  id: string;
  intakeId: string;
  ordinal: number;
  rawBlock: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  instagramHandle?: string;
  instagramProfileUrl?: string;
  captionSnippet?: string;
  signalType?: "provider" | "client_tagged" | "unknown";
  serviceHint?: string;
  geoHint?: string;
  roleLabel?: string;
  priceText?: string;
  priceValue?: number | null;
  parseConfidence: ParseConfidence;
  parseWarnings?: string[];
  suggestedMatch?: CandidateMatchSuggestion;
  reviewAction?: "accept_match" | "force_new" | "hold" | "pending";
};

export type CandidateMatchSuggestion = {
  disposition: MatchDisposition;
  matchedOperatorId?: string;
  matchedOperatorName?: string;
  matchedFacilityId?: string;
  score: number;
  reasons: string[];
};

export type IntakeProcessingReceipt = {
  id: string;
  intakeId: string;
  processedAt: string;
  processedBy?: string;
  evidenceCreated: number;
  matchedCount: number;
  newCandidateCount: number;
  heldCount: number;
  candidateResults: IntakeCandidateProcessResult[];
};

export type IntakeCandidateProcessResult = {
  candidateId: string;
  displayName: string;
  action: "matched" | "new_candidate" | "held";
  operatorId?: string;
  createdCandidateId?: string;
  evidenceIds: string[];
  notes?: string[];
};

export type SourceIntakeCreateInput = {
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  notes?: string;
  rawText: string;
};

export type OperatorEvidenceFactType =
  | "team_membership"
  | "role"
  | "price"
  | "license_status"
  | "license_number"
  | "license_type"
  | "license_city"
  | "instagram_handle"
  | "booking_url"
  | "website_url"
  | "linktree_url"
  | "tiktok_handle";

export type StagedOperatorEvidence = {
  id: string;
  intakeId: string;
  candidateId: string;
  operatorId?: string;
  facilityId?: string;
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl?: string;
  observedAt: string;
  candidateName: string;
  factType: OperatorEvidenceFactType;
  factValue: string;
  confidence: ParseConfidence;
};

export type OperatorCandidateRecord = {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  sourceIntakeId: string;
  sourceLabel: string;
  sourceType: SourceType;
  createdAt: string;
  status: "unresolved" | "validated" | "rejected";
};

export type IntakeQueueItem = {
  id: string;
  intakeId: string;
  candidateId: string;
  name: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  createdAt: string;
  status: "queued";
};

export const SOURCE_TYPES: SourceType[] = [
  "scheduler_roster",
  "team_page",
  "booking_menu",
  "suite_directory",
  "instagram_bio",
  "linktree",
  "marketplace_listing",
  "manual_field_note",
];

export const REVIEW_ACTIONS = ["accept_match", "force_new", "hold", "pending"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
