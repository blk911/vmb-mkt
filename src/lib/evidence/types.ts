export type EvidenceSource = "dora" | "google" | "instagram" | "booking" | "directory" | "container" | "website" | "manual_upload";

export type EvidenceType = "direct_operator" | "direct_upload" | "directory_listing" | "suite_container" | "social_profile" | "social_post";

export type EvidenceRecord = {
  id: string;
  source: EvidenceSource;
  sourceUrl?: string;
  sourceId?: string;
  title?: string;
  text?: string;
  handle?: string;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  booking?: string;
  category?: string;
  parentContainerName?: string;
  parentContainerAddress?: string;
  evidenceType?: EvidenceType;
  childQuerySeeds?: string[];
  metadata?: Record<string, unknown>;
  raw?: unknown;
  extracted?: unknown;
  createdAt: number;
};

