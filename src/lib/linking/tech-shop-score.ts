import type { BaseEntity, Cluster } from "@/lib/cluster/types";
import { getLocationLockResult } from "@/lib/cluster/location-lock";
import type { TechShopConfidenceLevel } from "./types";

function normalize(str?: string) {
  return (str || "").toLowerCase();
}

function firstName(name: string): string {
  return normalize(name).split(" ")[0] || "";
}

function nameMatchScore(tech: BaseEntity, shop: Cluster): number {
  const tName = firstName(tech.name);

  const shopNames = [shop.displayName, ...shop.altNames].map(normalize);

  // weak direct match (rare case)
  if (tName && shopNames.some((n) => n.includes(tName))) {
    return 25;
  }

  return 0;
}

function proximityScore(tech: BaseEntity, shop: Cluster): number {
  if (typeof tech.lat !== "number" || typeof tech.lng !== "number") return 0;
  if (typeof shop.lat !== "number" || typeof shop.lng !== "number") return 0;

  const dx = tech.lat - shop.lat;
  const dy = tech.lng - shop.lng;
  const d = Math.sqrt(dx * dx + dy * dy) * 69;

  if (d <= 0.02) return 30;
  if (d <= 0.05) return 20;
  if (d <= 0.1) return 12;
  if (d <= 0.25) return 6;

  return 0;
}

function categoryScore(tech: BaseEntity, shop: Cluster): number {
  if (!tech.category || !shop.headEntity.category) return 0;

  if (tech.category === shop.headEntity.category) return 15;

  const family = ["hair", "barber", "cos", "spa"];
  if (family.includes(tech.category) && family.includes(shop.headEntity.category)) {
    return 8;
  }

  return 0;
}

function locationSupportScore(tech: BaseEntity, shop: Cluster): number {
  const lock = getLocationLockResult(tech, shop.headEntity);

  if (!lock.hasLock) return 0;

  if (lock.normalizedAddressMatchExact) return 50;
  if (lock.suiteMatch) return 40;
  if (lock.sameBuildingParcel) return 30;

  return 0;
}

export function scoreTechToShop(tech: BaseEntity, shop: Cluster) {
  const nameMatch = nameMatchScore(tech, shop);
  const proximity = proximityScore(tech, shop);
  const categoryMatch = categoryScore(tech, shop);
  const locationSupport = locationSupportScore(tech, shop);

  const raw = nameMatch + proximity + categoryMatch + locationSupport;
  const total = Math.min(100, raw);

  let level: TechShopConfidenceLevel = "weak";

  if (total >= 80) level = "confirmed";
  else if (total >= 60) level = "likely";
  else if (total >= 40) level = "candidate";

  return {
    score: total,
    level,
    signals: {
      nameMatch,
      proximity,
      categoryMatch,
      locationSupport,
    },
  };
}
