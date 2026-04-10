// Manual IG clusters capture hand-curated adjacency networks copied from a target
// salon/profile. They stay intentionally staged apart from automated discovery so
// high-signal follow graphs do not contaminate broader lead datasets before review.
export type ManualIgClusterItemStatus =
  | "unreviewed"
  | "accepted"
  | "rejected";

export type ManualIgCategoryGuess =
  | "hair"
  | "nails"
  | "lashes"
  | "salon"
  | "client"
  | "connector"
  | "fitness"
  | "real_estate"
  | "unknown";

export interface ManualIgClusterItem {
  id: string;
  handle: string;
  displayName: string;
  rawLine: string;
  categoryGuess: ManualIgCategoryGuess;
  confidence: number;
  notes?: string;
  status: ManualIgClusterItemStatus;
  acceptedAt?: string;
  rejectedAt?: string;
}

export interface ManualIgClusterSourceMeta {
  originHandle: string;
  captureMethod: "copy_paste";
  capturedAt: string;
  clusterId: string;
  market?: string;
  tags?: string[];
}

export interface ManualIgCluster {
  clusterId: string;
  createdAt: string;
  updatedAt: string;
  sourceMeta: ManualIgClusterSourceMeta;
  itemCount: number;
  acceptedCount: number;
  rejectedCount: number;
  unreviewedCount: number;
  items: ManualIgClusterItem[];
}

export interface ManualIgAcceptedRecord {
  id: string;
  acceptedAt: string;
  clusterId: string;
  originHandle: string;
  handle: string;
  displayName: string;
  categoryGuess: ManualIgCategoryGuess;
  confidence: number;
  source: "manual_ig_cluster";
  evidenceType: "social_seed";
  platform: "instagram";
  captureMethod: "copy_paste";
  market?: string;
  tags?: string[];
}
