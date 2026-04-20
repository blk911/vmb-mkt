import type { ParseConfidence, SourceType } from "./types";

export type QueueStatus =
  | "queued"
  | "processing"
  | "resolved"
  | "approved"
  | "merged"
  | "rejected"
  | "failed"
  | "dismissed";

export type ValidationReviewOutcome = "approved" | "merged" | "rejected";

export type DoraMatchStatus =
  | "active_match"
  | "inactive_match"
  | "possible_match"
  | "not_found";

export type SocialSurfaceType =
  | "instagram"
  | "booking"
  | "website"
  | "linktree"
  | "tiktok";

export type DoraValidationQueueItem = {
  id: string;
  intakeId: string;
  candidateId: string;
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  status: QueueStatus;
  attempts: number;
  lastAttemptAt?: string;
};

export type DoraValidationResult = {
  id: string;
  queueItemId: string;
  intakeId: string;
  candidateId: string;
  resolvedAt: string;
  status: DoraMatchStatus;
  matchedLicenseName?: string;
  matchedLicenseNumber?: string;
  licenseType?: string;
  licenseStatusText?: string;
  city?: string;
  state?: string;
  score: number;
  reasons: string[];
  evidenceIds: string[];
  finalStatus?: ValidationReviewOutcome;
  mergeTargetId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  targetOperatorId?: string;
};

export type SocialDiscoveryQueueItem = {
  id: string;
  intakeId: string;
  candidateId: string;
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  displayName: string;
  createdAt: string;
  status: QueueStatus;
  attempts: number;
  lastAttemptAt?: string;
};

export type SocialDiscoveryResult = {
  id: string;
  queueItemId: string;
  intakeId: string;
  candidateId: string;
  resolvedAt: string;
  discoveredSurfaces: Array<{
    type: SocialSurfaceType;
    value: string;
    confidence: "high" | "medium" | "low";
    reasons: string[];
  }>;
  evidenceIds: string[];
  finalStatus?: ValidationReviewOutcome;
  mergeTargetId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  targetOperatorId?: string;
};

export type DriftChangeType =
  | "added_person"
  | "removed_person"
  | "role_changed"
  | "price_changed"
  | "name_changed";

export type SourceIntakeDriftEvent = {
  id: string;
  sourceLabel: string;
  facilityId?: string;
  baselineIntakeId: string;
  comparisonIntakeId: string;
  detectedAt: string;
  changes: DriftChange[];
  summary: {
    added: number;
    removed: number;
    roleChanged: number;
    priceChanged: number;
    nameChanged: number;
  };
};

export type DriftChange = {
  type: DriftChangeType;
  baselineCandidateId?: string;
  comparisonCandidateId?: string;
  baselineDisplayName?: string;
  comparisonDisplayName?: string;
  baselineRole?: string;
  comparisonRole?: string;
  baselinePrice?: number | null;
  comparisonPrice?: number | null;
  confidence: ParseConfidence;
  reasons: string[];
};

export type OperatorCandidateLinkSuggestion = {
  id: string;
  candidateId: string;
  targetType: "operator_candidate" | "operator";
  targetId: string;
  score: number;
  reasons: string[];
  createdAt: string;
};
