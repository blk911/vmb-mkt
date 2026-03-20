import type { BaseEntity, Cluster } from "@/lib/cluster/types";

export type TechShopConfidenceLevel = "confirmed" | "likely" | "candidate" | "weak";

export interface TechShopLink {
  tech: BaseEntity;
  shop: Cluster;

  score: number;
  level: TechShopConfidenceLevel;

  signals: {
    nameMatch: number;
    proximity: number;
    categoryMatch: number;
    locationSupport: number;
  };

  notes: string[];
}
