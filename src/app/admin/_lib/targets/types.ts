import type { AdminQueryState } from "../adminQueryState";
import type { TargetActivity, TargetWorkflow } from "@/lib/ops/targetWorkflow";

export type TargetScope = "facility" | "tech";
export type TargetMembershipMode = "fixed" | "dynamic";

export type TargetItem = {
  kind: TargetScope;
  /** Legacy reference retained for compatibility; never used for fuzzy rematching. */
  refId: string;
  /** Exact shared catalog identity, captured when the membership is saved. */
  catalogId?: string;
  referenceResolution?: "unresolved" | "ambiguous";
  addressId?: string;
  label: string;
  city?: string;
  zip?: string;
  sizeBand?: string;
  tags?: string[];
  addedAt: string;
};

export type TargetList = {
  id: string;
  name: string;
  scope: TargetScope;
  createdAt: string;
  updatedAt: string;
  membershipMode: TargetMembershipMode;
  /** Fixed lists keep these IDs even if their records disappear from the catalog. */
  catalogIds: string[];
  notes?: string;
  workflow?: TargetWorkflow;
  activity?: TargetActivity[];
  savedQuery?: AdminQueryState | Record<string, unknown>;
  items: TargetItem[];
  archivedAt?: string;
  archivedBy?: string;
};

export type TargetListStorageCoverage = {
  store: "firestore";
  legacyFileLists: "not_imported_unverified";
  message: string;
};

export type TargetListIndex = {
  ok: true;
  updatedAt: string;
  coverage: TargetListStorageCoverage;
  lists: Array<{
    id: string;
    name: string;
    scope: TargetScope;
    membershipMode: TargetMembershipMode;
    updatedAt: string;
    itemCount?: number;
    archivedAt?: string;
  }>;
};
