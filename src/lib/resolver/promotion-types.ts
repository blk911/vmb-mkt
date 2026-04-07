import type { ResolverOperator } from "./types";
import type { PromotionLane } from "./promotion-lanes";

export type PromotionCandidate = {
  operator: ResolverOperator;
  score: number;
  reasons: string[];
};

export type PromotionResult = {
  operatorId: string;
  promotionLane?: PromotionLane;
  promotionMethod?: "google_search" | "directory_traversal" | "tenant_lift";
  yieldedDirectDetailPages?: boolean;
  childOperatorsCreated?: number;
  childOperatorsPromotedEnriched?: number;
  childOperatorsPromotedHot?: number;
  childPromotionOutcome?:
    | "none"
    | "child_created_only"
    | "child_promoted_enriched"
    | "child_promoted_hot"
    | "child_created_and_promoted";
  addedEvidenceCount: number;
  previousStatus: ResolverOperator["status"];
  nextStatus: ResolverOperator["status"];
  reasons: string[];
  queriesRun: string[];
  changed: boolean;
};

export type PromotionSummary = {
  attemptedOperators: number;
  evidenceAdded: number;
  extractedEvidenceAdded: number;
  childOperatorsCreated: number;
  childOperatorsPromotedEnriched: number;
  childOperatorsPromotedHot: number;
  operatorsWithNewBooking: number;
  operatorsWithNewInstagram: number;
  operatorsWithNewWebsite: number;
  promotedToEnriched: number;
  promotedToHot: number;
  unchanged: number;
};

