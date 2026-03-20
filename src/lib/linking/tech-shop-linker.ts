import type { BaseEntity, Cluster } from "@/lib/cluster/types";
import type { TechShopLink } from "./types";
import { scoreTechToShop } from "./tech-shop-score";

export function linkTechsToShop(shop: Cluster, allEntities: BaseEntity[]): TechShopLink[] {
  const techs = allEntities.filter((e) => e.type === "dora_person");

  const links: TechShopLink[] = techs.map((tech) => {
    const result = scoreTechToShop(tech, shop);

    const notes: string[] = [];

    if (result.signals.locationSupport > 0) {
      notes.push("location-supported");
    }

    if (result.signals.proximity > 0) {
      notes.push("nearby");
    }

    if (result.signals.categoryMatch > 0) {
      notes.push("category-aligned");
    }

    if (result.signals.nameMatch > 0) {
      notes.push("name-signal");
    }

    return {
      tech,
      shop,
      score: result.score,
      level: result.level,
      signals: result.signals,
      notes,
    };
  });

  return links.sort((a, b) => b.score - a.score);
}
