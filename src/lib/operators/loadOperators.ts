import { loadResolverBackedOperatorsWithReview } from "./review-store";
import type { OperatorRecord } from "./types";

export function loadOperatorsFromResolverRegistry(): OperatorRecord[] {
  return loadResolverBackedOperatorsWithReview();
}

