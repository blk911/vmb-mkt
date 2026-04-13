// Sola locations are modeled as parent containers and tenant businesses are
// modeled as child records so container-first prospecting and child recovery
// can stay structured without collapsing parent/child lineage into flat leads.
export type SolaContainerStatus =
  | "seeded"
  | "resolved"
  | "tenant_pull_ready"
  | "tenant_pull_in_progress"
  | "tenant_pull_complete";

export interface SolaContainer {
  id: string;
  brand: "Sola Salons";
  market: string;
  region: string;
  name: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  distanceMiles?: number;
  addressText?: string;
  locationPageUrl?: string;
  directoryPageUrl?: string;
  source: "manual_seed";
  sourceLabel: string;
  status: SolaContainerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SolaTenantRecord {
  id: string;
  containerId: string;
  containerName: string;
  tenantName: string;
  categoryGuess: string;
  suite?: string;
  phone?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  bookingUrl?: string;
  sourceType: "official_directory" | "manual_extract" | "unknown";
  evidenceLabel?: string;
  status: "extracted" | "reviewed" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
}
