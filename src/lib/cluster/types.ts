export type EntityType = "google_place" | "dora_shop" | "dora_person";

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  normalizedName?: string;
  lat?: number;
  lng?: number;
  address?: string;
  normalizedAddress?: string;
  category?: string;
  subtype?: string;
}

export interface Cluster {
  clusterId: string;
  displayName: string;
  lat?: number;
  lng?: number;

  clusterHeadType: "google" | "dora_shop" | "hybrid";

  google: BaseEntity[];
  doraShops: BaseEntity[];
  doraPeople: BaseEntity[];

  confidence: number;
  status: "confirmed" | "probable" | "possible" | "unresolved";

  reasons: string[];
}
