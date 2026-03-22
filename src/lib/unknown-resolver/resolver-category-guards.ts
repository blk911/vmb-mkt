import type { ResolverCategory } from "./resolver-categories";
import type { UnknownResolverRecord } from "./resolver-types";

export function isHouseCleaningCategory(category: ResolverCategory | null | undefined): boolean {
  return category === "house_cleaning";
}

/** Record may appear in the house_cleaning Unknown Resolver queue. */
export function canEnterHouseCleaningResolver(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isHouseCleaningCategory(record.category);
}

/** House cleaning scoring pipeline applies. */
export function canUseHouseCleaningScoring(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isHouseCleaningCategory(record.category);
}

/**
 * Eligible for promote-to-outreach (house_cleaning v1). Operator yes is enforced in storage/UI separately.
 */
export function canPromoteResolverRecord(record: Pick<UnknownResolverRecord, "category">): boolean {
  return isHouseCleaningCategory(record.category);
}
