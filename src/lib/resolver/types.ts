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
  createdAt: number;
  updatedAt: number;
};

