import type { BuildSubmitDebugInfo, ValidationLoadDebugInfo } from "./runtime-debug";

export type BuildSourceType = "Instagram" | "DORA" | "Upload" | "URL";

export type BuildSubmissionSummary = {
  recordsReceived: number;
  evidenceAdded: number;
  operatorsCreated: number;
  notes?: string[];
};

export type BuildSubmissionResult =
  | {
      ok: true;
      endpoint: string;
      summary: BuildSubmissionSummary;
      raw: unknown;
      debug?: BuildSubmitDebugInfo;
    }
  | {
      ok: false;
      endpoint?: string;
      error: string;
      debug?: BuildSubmitDebugInfo;
    };

export type ValidationQueueSource = "DORA" | "SOCIAL";

export type ValidationQueueRow = {
  queueItemId: string;
  intakeId: string;
  candidateId: string;
  displayName: string;
  city?: string;
  state?: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceType: ValidationQueueSource;
  status: string;
  confidence: string;
  confidenceScore?: number;
  createdAt: string;
  resolvedAt?: string;
};

export type ValidationDetail = {
  row: ValidationQueueRow;
  resolveEndpoint: string;
  candidate?: {
    displayName: string;
    roleLabel?: string;
    priceText?: string;
    parseConfidence?: string;
    parseWarnings?: string[];
    rawBlock?: string;
  };
  intake?: {
    id: string;
    sourceLabel: string;
    sourceType: string;
    sourceUrl?: string;
    status: string;
    submittedAt: string;
  };
  resultSummary?: {
    title: string;
    lines: string[];
  };
  historicalProcessing?: {
    present: boolean;
    processedAt?: string;
    matchedCount?: number;
    newCandidateCount?: number;
    heldCount?: number;
  };
};

export type TargetRow = {
  operatorId: string;
  name: string;
  city: string;
  category: string;
  instagram?: string;
  hasInstagram: boolean;
  confidenceScore: number;
  status: string;
};

export type OutreachQueueItem = {
  operatorId: string;
  name: string;
  ig?: string;
  priority: string;
  city?: string;
  category?: string;
  addedAt: string;
};

export type AdminDashboardMetrics = {
  newInputs: number;
  pendingValidation: number;
  readyTargets: number;
  activeOutreach: number;
};

export type AdminActionLogEntry = {
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  details?: Record<string, unknown>;
};

export type ValidationPageDebug = ValidationLoadDebugInfo;
