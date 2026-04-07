import type { ResolverOperator } from "./types";

type PromotionMethod = "google_search" | "directory_traversal" | "tenant_lift";

export type TenantPromotionOutcome = {
  childOperatorsCreated: number;
  childOperatorsPromotedEnriched: number;
  childOperatorsPromotedHot: number;
  childOperatorsWithNewBooking: number;
  childOperatorsWithNewInstagram: number;
  childOperatorsWithNewWebsite: number;
  childPromotionOutcome:
    | "none"
    | "child_created_only"
    | "child_promoted_enriched"
    | "child_promoted_hot"
    | "child_created_and_promoted";
};

function sourceMethod(row: ResolverOperator["sources"][number]): PromotionMethod | undefined {
  if (!row.raw || typeof row.raw !== "object") return undefined;
  if (!("promotionMethod" in (row.raw as Record<string, unknown>))) return undefined;
  const value = String((row.raw as Record<string, unknown>).promotionMethod || "");
  if (value === "google_search" || value === "directory_traversal" || value === "tenant_lift") return value;
  return undefined;
}

function sourceOperatorId(row: ResolverOperator["sources"][number]): string | undefined {
  if (!row.raw || typeof row.raw !== "object") return undefined;
  if (!("operatorId" in (row.raw as Record<string, unknown>))) return undefined;
  const value = String((row.raw as Record<string, unknown>).operatorId || "");
  return value || undefined;
}

function isLinkedChildOperator(op: ResolverOperator, parentOperatorId: string): boolean {
  if (op.isContainer) return false;
  return op.sources.some((row) => sourceMethod(row) === "tenant_lift" && sourceOperatorId(row) === parentOperatorId);
}

function hasDirectSurface(op?: ResolverOperator): { booking: boolean; instagram: boolean; website: boolean } {
  return {
    booking: Boolean(op?.canonicalBooking),
    instagram: Boolean(op?.canonicalInstagram),
    website: Boolean(op?.canonicalWebsite),
  };
}

export function evaluateTenantPromotionOutcome(input: {
  parentOperatorId: string;
  beforeMap: Map<string, ResolverOperator>;
  afterMap: Map<string, ResolverOperator>;
}): TenantPromotionOutcome {
  const linkedAfter = [...input.afterMap.values()].filter((op) => isLinkedChildOperator(op, input.parentOperatorId));

  let childOperatorsCreated = 0;
  let childOperatorsPromotedEnriched = 0;
  let childOperatorsPromotedHot = 0;
  let childOperatorsWithNewBooking = 0;
  let childOperatorsWithNewInstagram = 0;
  let childOperatorsWithNewWebsite = 0;

  for (const after of linkedAfter) {
    const before = input.beforeMap.get(after.id);
    if (!before) childOperatorsCreated += 1;

    const beforeStatus = before?.status;
    if (after.status === "enriched" && beforeStatus !== "enriched" && beforeStatus !== "hot" && beforeStatus !== "ready") {
      childOperatorsPromotedEnriched += 1;
    }
    if (after.status === "hot" && beforeStatus !== "hot" && beforeStatus !== "ready") {
      childOperatorsPromotedHot += 1;
    }

    const beforeSurface = hasDirectSurface(before);
    const afterSurface = hasDirectSurface(after);
    if (!beforeSurface.booking && afterSurface.booking) childOperatorsWithNewBooking += 1;
    if (!beforeSurface.instagram && afterSurface.instagram) childOperatorsWithNewInstagram += 1;
    if (!beforeSurface.website && afterSurface.website) childOperatorsWithNewWebsite += 1;
  }

  let childPromotionOutcome: TenantPromotionOutcome["childPromotionOutcome"] = "none";
  if (childOperatorsCreated > 0 && (childOperatorsPromotedEnriched > 0 || childOperatorsPromotedHot > 0)) {
    childPromotionOutcome = "child_created_and_promoted";
  } else if (childOperatorsPromotedHot > 0) {
    childPromotionOutcome = "child_promoted_hot";
  } else if (childOperatorsPromotedEnriched > 0) {
    childPromotionOutcome = "child_promoted_enriched";
  } else if (childOperatorsCreated > 0) {
    childPromotionOutcome = "child_created_only";
  }

  return {
    childOperatorsCreated,
    childOperatorsPromotedEnriched,
    childOperatorsPromotedHot,
    childOperatorsWithNewBooking,
    childOperatorsWithNewInstagram,
    childOperatorsWithNewWebsite,
    childPromotionOutcome,
  };
}

