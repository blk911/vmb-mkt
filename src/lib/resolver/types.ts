import type { EvidenceRecord } from "@/lib/evidence/types";

export type ResolverOperator = {
  id: string;
  canonicalName?: string;
  canonicalAddress?: string;
  canonicalCity?: string;
  canonicalPhone?: string;
  canonicalWebsite?: string;
  canonicalInstagram?: string;
  canonicalBooking?: string;
  category?: string;
  sources: EvidenceRecord[];
  confidenceScore: number;
  status: "enumerated" | "enriched" | "hot" | "ready" | "shelved";
  isContainer?: boolean;
  parentContainerId?: string;
  reviewState?: "unreviewed" | "ready" | "shelved_by_review";
  reviewNotes?: string;
  preferredContactSurface?: "booking" | "instagram" | "website" | "phone" | "none";
  normalizedCategory?: "nails" | "lashes" | "brows" | "hair" | "spa" | "multi_service" | "unknown";
  promotionScore?: number;
  promotionReasons?: string[];
  promotionState?: "untried" | "attempted" | "promoted_enriched" | "promoted_hot" | "unchanged";
  promotionLane?: "website_backed" | "directory_backed" | "container_adjacent" | "identity_only";
  compactedFromCount?: number;
  childState?: "not_child" | "provisional_child" | "resolved_child";
  createdAt: number;
  updatedAt: number;
};

