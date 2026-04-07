import type { ResolverOperator } from "./types";

export type PromotionCandidate = {
  operator: ResolverOperator;
  score: number;
  reasons: string[];
};

export type PromotionResult = {
  operatorId: string;
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
  operatorsWithNewBooking: number;
  operatorsWithNewInstagram: number;
  operatorsWithNewWebsite: number;
  promotedToEnriched: number;
  promotedToHot: number;
  unchanged: number;
};

