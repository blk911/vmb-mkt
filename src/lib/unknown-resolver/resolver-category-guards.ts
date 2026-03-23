import { isActiveResolverCategory, type ResolverCategory } from "./resolver-categories";
import type { UnknownResolverRecord } from "./resolver-types";

/** Recognized category id (not necessarily active in the live pipeline). */
export function isHouseCleaningCategory(category: ResolverCategory | null | undefined): boolean {
  return category === "house_cleaning";
}

export function isNailsCategory(category: ResolverCategory | null | undefined): boolean {
  return category === "nails";
}

/** Record may appear in the Unknown Resolver queue (active categories only; e.g. nails — not parked house_cleaning). */
export function canEnterActiveResolverQueue(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isActiveResolverCategory(record.category);
}

/** @deprecated Use canEnterActiveResolverQueue */
export function canEnterHouseCleaningResolver(record: Pick<UnknownResolverRecord, "category">): boolean {
  return canEnterActiveResolverQueue(record);
}

export function canUseHouseCleaningScoring(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isHouseCleaningCategory(record.category);
}

export function canUseNailsScoring(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isNailsCategory(record.category);
}

/** True when this record uses a scorer that is both implemented and active in the live pipeline. */
export function canUseResolverScoring(record: Pick<UnknownResolverRecord, "category">): boolean {
  if (!isActiveResolverCategory(record.category)) return false;
  return canUseHouseCleaningScoring(record) || canUseNailsScoring(record);
}

/**
 * When `category` is an active resolver category, record must match it.
 */
export function canEnterResolverCategory(
  record: Pick<UnknownResolverRecord, "category">,
  category: ResolverCategory
): boolean {
  return record.category === category && isActiveResolverCategory(category);
}

/**
 * Eligible for promote-to-outreach for active resolver categories. Operator yes enforced in storage/UI.
 */
export function canPromoteResolverRecord(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isActiveResolverCategory(record.category);
}
