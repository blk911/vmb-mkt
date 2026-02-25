import type { AdminQueryState } from "../adminQueryState";

export type TargetScope = "facility" | "tech";

export type TargetList = {
  id: string; // "tgt_20260203_xxxxxx"
  name: string; // "Lone Tree - Nails - 6-15"
  scope: TargetScope; // facility or tech
  createdAt: string;
  updatedAt: string;

  // This is the saved "view" (query state snapshot)
  savedQuery?: AdminQueryState;

  // Items are normalized minimal refs
  items: Array<{
    kind: TargetScope;
    refId: string; // facilityId OR licenseId
    addressId?: string;
    label: string; // display name
    city?: string;
    zip?: string;
    sizeBand?: string;
    tags?: string[];
    addedAt: string;
  }>;
};

export type TargetListIndex = {
  ok: true;
  updatedAt: string;
  lists: Array<{
    id: string;
    name: string;
    scope: TargetScope;
    updatedAt: string;
    itemCount?: number;
  }>;
};
