export type EvidenceSource = "dora" | "google" | "instagram" | "booking" | "directory" | "container" | "website";

export type EvidenceType = "direct_operator" | "directory_listing" | "suite_container" | "social_profile";

export type EvidenceRecord = {
  id: string;
  source: EvidenceSource;
  sourceUrl?: string;
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
  raw?: unknown;
  extracted?: unknown;
  createdAt: number;
};

