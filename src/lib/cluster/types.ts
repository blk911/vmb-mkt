export type EntityType = "google_place" | "dora_shop" | "dora_person";

export type ClusterStatus = "confirmed" | "probable" | "possible" | "unresolved";

export type ClusterHeadType = "google" | "dora_shop" | "hybrid";

export type MergeDecision = "merged" | "candidate_only" | "blocked";

export type DiagnosticCode =
  | "ADDR_MATCH"
  | "ADDR_PARTIAL"
  | "DIST_NEAR"
  | "DIST_FAR"
  | "NAME_STRONG"
  | "NAME_WEAK"
  | "CATEGORY_MATCH"
  | "CATEGORY_CONFLICT"
  | "PERSON_NOT_SHOP"
  | "NO_USABLE_ADDRESS"
  | "MULTI_ANCHOR_CONFLICT"
  | "SUITE_CONFLICT"
  | "COMPETING_BRAND"
  | "LOW_CONFIDENCE_ONLY"
  | "MERGED_BY_DOMINANT_ANCHOR";

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  normalizedName?: string;
  brandCoreName?: string;
  lat?: number;
  lng?: number;
  address?: string;
  normalizedAddress?: string;
  category?: string;
  subtype?: string;
  phone?: string;
  website?: string;
  licenseId?: string;
  source?: string;
  zone?: string;
  corridor?: string;
}

export interface MatchBreakdown {
  score: number;
  distanceMiles: number;
  distanceScore: number;
  nameScore: number;
  categoryScore: number;
  addressScore: number;
  supportScore: number;
  diagnostics: DiagnosticCode[];
}

export interface ClusterAttachment {
  entity: BaseEntity;
  decision: MergeDecision;
  breakdown: MatchBreakdown;
}

export interface Cluster {
  clusterId: string;
  displayName: string;
  displayAddress?: string;
  lat?: number;
  lng?: number;

  clusterHeadType: ClusterHeadType;
  headEntity: BaseEntity;

  google: ClusterAttachment[];
  doraShops: ClusterAttachment[];
  doraPeople: ClusterAttachment[];

  confidence: number;
  status: ClusterStatus;

  altNames: string[];
  reasons: string[];
  diagnostics: DiagnosticCode[];

  zone?: string;
  corridor?: string;
}
