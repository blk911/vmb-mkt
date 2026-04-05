import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";

export type BatchIngestMode = "review_seed" | "attach_only" | "best_effort";

export type BatchIngestPayload = {
  targetId?: string;
  inputs: SourceCandidateInput[];
  sourceBatchLabel?: string;
  mode?: BatchIngestMode;
};

export type BatchIngestOutcome =
  | "attached"
  | "created_review_candidate"
  | "duplicate"
  | "already_present"
  | "suppressed"
  | "rejected"
  | "skipped";

export type BatchIngestResult = {
  sourceLabel?: string;
  sourceType: string;
  candidateKey?: string;
  targetId?: string | null;
  outcome: BatchIngestOutcome;
  reason?: string;
  evidence?: string[];
};

export type BatchIngestSummary = {
  totalProcessed: number;
  attached: number;
  createdReviewCandidate: number;
  duplicates: number;
  alreadyPresent: number;
  suppressed: number;
  rejected: number;
  skipped: number;
  errors: number;
};

export type BatchIngestResponse = {
  ok: true;
  summary: BatchIngestSummary;
  results: BatchIngestResult[];
  targets: number;
};

