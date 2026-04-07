import fs from "node:fs";
import path from "node:path";
import type { PromotionResult } from "./promotion-types";
import type { ResolverOperator } from "./types";
import { queriesMatchLaneStrategy, type PromotionLane } from "./promotion-lanes";

const PROMOTION_AUDIT_PATH = path.join(process.cwd(), "runtime-data/promotion_audit.json");

type PromotionAuditRow = {
  operatorId: string;
  promotionLane: PromotionLane;
  promotionMethod: "google_search" | "directory_traversal" | "tenant_lift";
  laneStrategyMatched: boolean;
  yieldedDirectDetailPages: boolean;
  childOperatorsCreated: number;
  childOperatorsPromotedEnriched: number;
  childOperatorsPromotedHot: number;
  childPromotionOutcome: "none" | "child_created_only" | "child_promoted_enriched" | "child_promoted_hot" | "child_created_and_promoted";
  previousStatus: ResolverOperator["status"];
  nextStatus: ResolverOperator["status"];
  statusChanged: boolean;
  preCanonical: {
    instagram?: string;
    booking?: string;
    website?: string;
  };
  postCanonical: {
    instagram?: string;
    booking?: string;
    website?: string;
  };
  newCanonicalInstagram: boolean;
  newCanonicalBooking: boolean;
  newCanonicalWebsite: boolean;
  newEvidenceCount: number;
  newEvidenceSourceMix: Record<string, number>;
  unchangedReason?:
    | "parent_unchanged_but_child_created"
    | "parent_unchanged_child_not_strong_enough"
    | "no_new_direct_surface"
    | "only_duplicate_or_weak_evidence"
    | "resolver_threshold_not_met"
    | "identity_still_weak";
  auditReason:
    | "no_new_direct_surface"
    | "only_duplicate_or_weak_evidence"
    | "resolver_threshold_not_met"
    | "identity_still_weak"
    | "parent_unchanged_but_child_created"
    | "parent_unchanged_child_not_strong_enough"
    | "promoted";
};

function hasStrongIdentity(op?: ResolverOperator): boolean {
  if (!op) return false;
  return Boolean(op.canonicalName && (op.canonicalCity || op.canonicalAddress));
}

function chooseReason(input: {
  changed: boolean;
  addedEvidenceCount: number;
  newSurface: boolean;
  childOperatorsCreated: number;
  childOperatorsPromoted: number;
  post?: ResolverOperator;
}): PromotionAuditRow["auditReason"] {
  if (input.changed) return "promoted";
  if (input.childOperatorsCreated > 0 && input.childOperatorsPromoted === 0) return "parent_unchanged_but_child_created";
  if (input.childOperatorsCreated > 0 && input.childOperatorsPromoted > 0) return "promoted";
  if (!input.newSurface) return "no_new_direct_surface";
  if (input.addedEvidenceCount === 0) return "only_duplicate_or_weak_evidence";
  if (!hasStrongIdentity(input.post)) return "identity_still_weak";
  return "resolver_threshold_not_met";
}

export function writePromotionAudit(input: {
  attempts: PromotionResult[];
  beforeMap: Map<string, ResolverOperator>;
  afterMap: Map<string, ResolverOperator>;
  evidenceByOperator: Map<string, { count: number; sourceMix: Record<string, number> }>;
}): string {
  const rows: PromotionAuditRow[] = input.attempts.map((attempt) => {
    const pre = input.beforeMap.get(attempt.operatorId);
    const post = input.afterMap.get(attempt.operatorId);
    const preCanonical = {
      instagram: pre?.canonicalInstagram,
      booking: pre?.canonicalBooking,
      website: pre?.canonicalWebsite,
    };
    const postCanonical = {
      instagram: post?.canonicalInstagram,
      booking: post?.canonicalBooking,
      website: post?.canonicalWebsite,
    };
    const newCanonicalInstagram = Boolean(!preCanonical.instagram && postCanonical.instagram);
    const newCanonicalBooking = Boolean(!preCanonical.booking && postCanonical.booking);
    const newCanonicalWebsite = Boolean(!preCanonical.website && postCanonical.website);
    const evidence = input.evidenceByOperator.get(attempt.operatorId) || { count: 0, sourceMix: {} };
    const changed = attempt.previousStatus !== attempt.nextStatus;
    const newSurface = newCanonicalInstagram || newCanonicalBooking || newCanonicalWebsite;
    const childCreated = attempt.childOperatorsCreated || 0;
    const childPromoted = (attempt.childOperatorsPromotedEnriched || 0) + (attempt.childOperatorsPromotedHot || 0);
    const auditReason = chooseReason({
      changed,
      addedEvidenceCount: evidence.count,
      newSurface,
      childOperatorsCreated: childCreated,
      childOperatorsPromoted: childPromoted,
      post,
    });
    const unchangedReason =
      changed
        ? undefined
        : childCreated > 0
          ? childPromoted > 0
            ? undefined
            : "parent_unchanged_but_child_created"
          : newSurface
            ? "parent_unchanged_child_not_strong_enough"
            : "no_new_direct_surface";

    return {
      operatorId: attempt.operatorId,
      promotionLane: attempt.promotionLane || "identity_only",
      promotionMethod: attempt.promotionMethod || "google_search",
      laneStrategyMatched:
        attempt.promotionMethod && attempt.promotionMethod !== "google_search"
          ? true
          : queriesMatchLaneStrategy(attempt.promotionLane || "identity_only", attempt.queriesRun),
      yieldedDirectDetailPages: Boolean(attempt.yieldedDirectDetailPages),
      childOperatorsCreated: childCreated,
      childOperatorsPromotedEnriched: attempt.childOperatorsPromotedEnriched || 0,
      childOperatorsPromotedHot: attempt.childOperatorsPromotedHot || 0,
      childPromotionOutcome: attempt.childPromotionOutcome || "none",
      previousStatus: attempt.previousStatus,
      nextStatus: attempt.nextStatus,
      statusChanged: changed,
      preCanonical,
      postCanonical,
      newCanonicalInstagram,
      newCanonicalBooking,
      newCanonicalWebsite,
      newEvidenceCount: evidence.count,
      newEvidenceSourceMix: evidence.sourceMix,
      unchangedReason,
      auditReason,
    };
  });

  fs.mkdirSync(path.dirname(PROMOTION_AUDIT_PATH), { recursive: true });
  fs.writeFileSync(
    PROMOTION_AUDIT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), audits: rows }, null, 2)}\n`
  );
  return "runtime-data/promotion_audit.json";
}

