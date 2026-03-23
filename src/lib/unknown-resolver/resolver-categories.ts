export type ResolverCategory = "house_cleaning" | "nails" | "hair" | "spa" | "unknown";

const RESOLVER_CATEGORY_VALUES: readonly ResolverCategory[] = [
  "house_cleaning",
  "nails",
  "hair",
  "spa",
  "unknown",
];

export const RESOLVER_CATEGORY_LABELS: Record<ResolverCategory, string> = {
  house_cleaning: "House Cleaning",
  nails: "Nails",
  hair: "Hair",
  spa: "Spa",
  unknown: "Unknown",
};

/**
 * Live resolver pipeline (Unknown Resolver + promote + outreach).
 * Other recognized categories may exist in data/seeds as parked reference (e.g. house_cleaning).
 */
export const ACTIVE_RESOLVER_CATEGORIES: ResolverCategory[] = ["nails"];

export function getActiveResolverCategories(): readonly ResolverCategory[] {
  return ACTIVE_RESOLVER_CATEGORIES;
}

/** Alias for product copy / config readers. */
export function getLiveResolverCategories(): readonly ResolverCategory[] {
  return getActiveResolverCategories();
}

export function isActiveResolverCategory(category: ResolverCategory | null | undefined): boolean {
  return category != null && (ACTIVE_RESOLVER_CATEGORIES as readonly string[]).includes(category);
}

export function isSupportedResolverCategory(value: string | null | undefined): value is ResolverCategory {
  if (value == null || value === "") return false;
  const t = value.trim().toLowerCase();
  return (RESOLVER_CATEGORY_VALUES as readonly string[]).includes(t);
}

/**
 * Normalize inbound category strings. Never silently maps to house_cleaning.
 * Invalid / missing → unknown.
 */
export function normalizeResolverCategory(value: string | null | undefined): ResolverCategory {
  if (value == null || value === "") return "unknown";
  const t = value.trim().toLowerCase();
  if (isSupportedResolverCategory(t)) return t;
  return "unknown";
}
