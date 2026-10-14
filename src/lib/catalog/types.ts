import type { DoraCrossReference, DoraLicenseClaim } from "@/lib/dora/types";
import type { CandidateProfile } from "@/lib/admin/pipeline/profile-types";

export type CatalogSourceRef = { collection: string; id: string; role: "source" | "review" | "profile" | "place" };
export type CatalogVertical = "Nail" | "Hair" | "Skin" | "Lash" | "Brow" | "Makeup" | "Massage" | "Waxing" | "Barber" | "Other";
export type CatalogMappingEvidence = {
  value: string; sourceRef: CatalogSourceRef; sourceField: string;
  basis: "explicit_source_field" | "attributed_fact"; sourceUrl?: string;
};
export type CatalogFieldMapping = {
  status: "source_reported" | "unknown" | "conflict";
  evidence: CatalogMappingEvidence[]; reason?: string;
};
export type CatalogLink = { id: string; entityType: "provider" | "business" | "place" | "evidence"; label: string; relationship: string; basis: "source_reported" | "reviewed" | "exact_source_id" };
export type CatalogDecision = { id: string; lane: string; status: string; reviewedAt?: string; reviewedBy?: string; targetId?: string; suggestedTargetId?: string };
export type CatalogFactClaim = {
  id: string; sourceRef: CatalogSourceRef; sourceField: string; kind: string; value: string;
  attribution: "candidate" | "business" | "unresolved"; status: "source_reported" | "discovered" | "rejected";
  sourceUrl?: string; observedAt?: string; confidence?: string; reasons?: string[]; reviewStatus?: string; evidenceIds?: string[]; raw?: unknown;
};
export type CatalogFieldCoverage = { records: number; knownPlatform: number; multiplePlatforms: number; booking: number; social: number; website: number; businessName: number; city: number; postalCode: number; factClaims: number; unresolvedLinks: number; licenseClaims: number; unknownWithRecoverableEvidence: number; conflicts: number; sourceTruncated: number };
export type CatalogEvidenceAudit = { version: number; baseline: "same_snapshot_primary_fields"; before: CatalogFieldCoverage; after: CatalogFieldCoverage; delta: CatalogFieldCoverage; derivedOnly: true; sourceDocumentsMutated: 0; baselineDescription: string; stableIds: { expected: number; projected: number; unique: number; unchanged: boolean }; recoveredUnknownRecords: number };
export type CatalogRecord = {
  dora?: DoraCrossReference;
  doraLicenseClaims?: { personLicense?: DoraLicenseClaim[]; shopRegistration?: DoraLicenseClaim[] };
  id: string;
  entityType: "provider" | "business";
  displayName: string;
  providerName: string;
  businessName: string;
  platformLabel: string;
  /** Read-time source mappings; no geographic inference or identity matching. */
  market?: string;
  marketId?: string;
  vertical?: CatalogVertical | "Multiple" | "Unknown";
  verticals?: CatalogVertical[];
  mapping?: { market: CatalogFieldMapping; vertical: CatalogFieldMapping };
  profile?: CandidateProfile;
  city: string;
  state: string;
  postalCode: string;
  area: string;
  services: string[];
  reviewStatus: string;
  reviewKey?: string;
  sourceRefs: CatalogSourceRef[];
  linkedEntities: CatalogLink[];
  reviewDecisions: CatalogDecision[];
  reviewLanes?: Array<{ lane: "DORA" | "SOCIAL"; queueItemId: string; status: string; actionable?: boolean }>;
  conflicts: string[];
  evidence: Array<{ id: string; sourceUrl?: string; observedAt?: string; kind: string; label: string }>;
  factClaims?: CatalogFactClaim[];
  updatedAt: string;
  legacyIds: string[];
  sourceIdentifiers?: { candidateId?: string; intakeId?: string; providerId?: string; businessId?: string; sourceScopedIds?: Array<{ sourceUrl: string; id: string }> };
  phone?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
};
export type CatalogFilters = {
  q?: string; market?: string; vertical?: string; platform?: string; entityType?: string; city?: string; postalCode?: string;
  area?: string; service?: string; reviewStatus?: string;
  needsReview?: "yes" | "no" | "all";
  hasBooking?: "yes" | "no" | "all"; hasSocial?: "yes" | "no" | "all";
  sort?: string; direction?: "asc" | "desc";
};
export type CatalogCoverage = {
  version: 1;
  storage: "firestore";
  strategy: "non_destructive_read_projection";
  complete: boolean;
  snapshotId: string;
  sourceCounts: Record<string, number>;
  recordCount: number;
  providerCount: number;
  businessCount: number;
  orphanQueueCount: number;
  orphanResultCount: number;
  conflictCount: number;
  warnings: string[];
  orphanEvidenceCount?: number;
  evidenceAudit?: CatalogEvidenceAudit;
  legacyFileEvidence?: { status: "unavailable_or_unimported"; importedCount: number; note: string };
};
export type SharedCatalog = { rows: CatalogRecord[]; coverage: CatalogCoverage; generatedAt: string };
