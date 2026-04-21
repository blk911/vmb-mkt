import fs from "node:fs/promises";
import path from "node:path";
import { listCanonicalOperators } from "@/lib/admin/operator-adapter";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { listDriftEvents, listOperatorCandidateLinks } from "@/lib/source-intake/phase2-store";
import type { SourceIntakeDriftEvent } from "@/lib/source-intake/phase2-types";
import { listProcessingReceipts, listSourceIntakes } from "@/lib/source-intake/store";
import { loadResolverRegistryForUi } from "@/lib/resolver/registry-store";
import { loadOperatorReviews } from "@/lib/operators/review-store";
import { listValidationRows } from "./validation";

type ResolverSummarySnapshot = {
  generatedAt: string;
  evidenceCount: number;
  operatorCount: number;
  hotCount: number;
  enrichedCount: number;
  enumeratedCount: number;
  containerCount: number;
  childOperatorCount: number;
  childWithBookingCount: number;
  childWithInstagramCount: number;
  childWithWebsiteCount: number;
  childWeakCount: number;
  preCompactionOperatorCount: number;
  postCompactionOperatorCount: number;
  compactedDuplicateCount: number;
};

export type PipelineReconciliationSnapshot = {
  processingReceipts: {
    totalIntakes: number;
    intakesWithReceipts: number;
    recent: Array<{
      intakeId: string;
      sourceLabel: string;
      processedAt: string;
      matchedCount: number;
      newCandidateCount: number;
      heldCount: number;
    }>;
  };
  drift: {
    totalIntakes: number;
    intakesWithDrift: number;
    recent: Array<{
      intakeId: string;
      sourceLabel: string;
      detectedAt: string;
      comparedAgainstIntakeId: string;
      added: number;
      removed: number;
      roleChanged: number;
      priceChanged: number;
      nameChanged: number;
    }>;
  };
  candidateLinks: {
    totalCandidates: number;
    candidatesWithLinks: number;
    recent: Array<{
      candidateId: string;
      queueItemId: string;
      displayName: string;
      sourceType: string;
      linkCount: number;
      bestScore: number;
    }>;
  };
  resolverSummary: ResolverSummarySnapshot | null;
  reviewCoverage: {
    resolverBackedCanonicalTargets: number;
    targetsWithReviewState: number;
    readyCount: number;
    shelvedCount: number;
    latestReviewAt?: string;
  };
};

export type HistoricalProcessingContext = {
  present: boolean;
  processedAt?: string;
  matchedCount?: number;
  newCandidateCount?: number;
  heldCount?: number;
};

export type LegacyReviewOverlayHint = {
  operatorId: string;
  present: boolean;
  reviewState?: string;
  updatedAt?: string;
};

async function readResolverSummary(): Promise<ResolverSummarySnapshot | null> {
  const summaryPath = path.join(getRuntimeDataRoot(), "resolver_summary.json");
  try {
    const raw = await fs.readFile(summaryPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const summary = parsed as Partial<ResolverSummarySnapshot>;
    if (typeof summary.generatedAt !== "string") return null;
    return {
      generatedAt: summary.generatedAt,
      evidenceCount: Number(summary.evidenceCount || 0),
      operatorCount: Number(summary.operatorCount || 0),
      hotCount: Number(summary.hotCount || 0),
      enrichedCount: Number(summary.enrichedCount || 0),
      enumeratedCount: Number(summary.enumeratedCount || 0),
      containerCount: Number(summary.containerCount || 0),
      childOperatorCount: Number(summary.childOperatorCount || 0),
      childWithBookingCount: Number(summary.childWithBookingCount || 0),
      childWithInstagramCount: Number(summary.childWithInstagramCount || 0),
      childWithWebsiteCount: Number(summary.childWithWebsiteCount || 0),
      childWeakCount: Number(summary.childWeakCount || 0),
      preCompactionOperatorCount: Number(summary.preCompactionOperatorCount || 0),
      postCompactionOperatorCount: Number(summary.postCompactionOperatorCount || 0),
      compactedDuplicateCount: Number(summary.compactedDuplicateCount || 0),
    };
  } catch {
    return null;
  }
}

function pickDisplayDriftIntake(event: SourceIntakeDriftEvent, intakeIds: Set<string>) {
  if (intakeIds.has(event.comparisonIntakeId)) {
    return {
      intakeId: event.comparisonIntakeId,
      comparedAgainstIntakeId: event.baselineIntakeId,
    };
  }
  return {
    intakeId: event.baselineIntakeId,
    comparedAgainstIntakeId: event.comparisonIntakeId,
  };
}

export async function getPipelineReconciliationSnapshot(): Promise<PipelineReconciliationSnapshot> {
  const [intakes, receipts, driftEvents, candidateLinks, validationRows, canonicalOperators, resolverSummary] = await Promise.all([
    listSourceIntakes(),
    listProcessingReceipts(),
    listDriftEvents(),
    listOperatorCandidateLinks(),
    listValidationRows(),
    listCanonicalOperators(),
    readResolverSummary(),
  ]);

  const intakeById = new Map(intakes.map((intake) => [intake.id, intake]));
  const intakeIds = new Set(intakes.map((intake) => intake.id));

  const latestReceiptByIntakeId = new Map<string, (typeof receipts)[number]>();
  for (const receipt of receipts) {
    const current = latestReceiptByIntakeId.get(receipt.intakeId);
    if (!current || receipt.processedAt > current.processedAt) {
      latestReceiptByIntakeId.set(receipt.intakeId, receipt);
    }
  }

  const receiptIntakeIds = [...latestReceiptByIntakeId.keys()].filter((intakeId) => intakeIds.has(intakeId));
  const processingRecent = [...latestReceiptByIntakeId.values()]
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt))
    .slice(0, 5)
    .map((receipt) => ({
      intakeId: receipt.intakeId,
      sourceLabel: intakeById.get(receipt.intakeId)?.sourceLabel || receipt.intakeId,
      processedAt: receipt.processedAt,
      matchedCount: receipt.matchedCount,
      newCandidateCount: receipt.newCandidateCount,
      heldCount: receipt.heldCount,
    }));

  const driftIntakeIds = new Set<string>();
  for (const event of driftEvents) {
    if (intakeIds.has(event.baselineIntakeId)) driftIntakeIds.add(event.baselineIntakeId);
    if (intakeIds.has(event.comparisonIntakeId)) driftIntakeIds.add(event.comparisonIntakeId);
  }
  const driftRecent = driftEvents.slice(0, 5).map((event) => {
    const joined = pickDisplayDriftIntake(event, intakeIds);
    return {
      intakeId: joined.intakeId,
      sourceLabel: intakeById.get(joined.intakeId)?.sourceLabel || event.sourceLabel,
      detectedAt: event.detectedAt,
      comparedAgainstIntakeId: joined.comparedAgainstIntakeId,
      added: event.summary.added,
      removed: event.summary.removed,
      roleChanged: event.summary.roleChanged,
      priceChanged: event.summary.priceChanged,
      nameChanged: event.summary.nameChanged,
    };
  });

  const validationCandidateIds = new Set(validationRows.map((row) => row.candidateId));
  const linksByCandidateId = new Map<string, (typeof candidateLinks)>();
  for (const link of candidateLinks) {
    const current = linksByCandidateId.get(link.candidateId) || [];
    current.push(link);
    linksByCandidateId.set(link.candidateId, current);
  }
  const candidateLinksRecent = validationRows
    .filter((row) => linksByCandidateId.has(row.candidateId))
    .slice(0, 5)
    .map((row) => {
      const links = linksByCandidateId.get(row.candidateId) || [];
      return {
        candidateId: row.candidateId,
        queueItemId: row.queueItemId,
        displayName: row.displayName,
        sourceType: row.sourceType,
        linkCount: links.length,
        bestScore: Math.max(...links.map((link) => link.score)),
      };
    });

  const resolverIds = new Set(loadResolverRegistryForUi().map((row) => row.id));
  const resolverBackedTargetIds = canonicalOperators
    .filter((operator) => resolverIds.has(operator.id))
    .map((operator) => operator.id);
  const reviews = loadOperatorReviews();
  const reviewMap = new Map(reviews.map((row) => [row.operatorId, row]));
  const matchedReviews = resolverBackedTargetIds
    .map((operatorId) => reviewMap.get(operatorId))
    .filter((review): review is NonNullable<typeof review> => Boolean(review));

  const latestReviewAt = matchedReviews
    .map((review) => review.updatedAt)
    .sort((a, b) => b.localeCompare(a))[0];

  return {
    processingReceipts: {
      totalIntakes: intakes.length,
      intakesWithReceipts: receiptIntakeIds.length,
      recent: processingRecent,
    },
    drift: {
      totalIntakes: intakes.length,
      intakesWithDrift: driftIntakeIds.size,
      recent: driftRecent,
    },
    candidateLinks: {
      totalCandidates: validationCandidateIds.size,
      candidatesWithLinks: [...validationCandidateIds].filter((candidateId) => linksByCandidateId.has(candidateId)).length,
      recent: candidateLinksRecent,
    },
    resolverSummary,
    reviewCoverage: {
      resolverBackedCanonicalTargets: resolverBackedTargetIds.length,
      targetsWithReviewState: matchedReviews.length,
      readyCount: matchedReviews.filter((review) => review.reviewState === "ready").length,
      shelvedCount: matchedReviews.filter((review) => review.reviewState === "shelved_by_review").length,
      latestReviewAt,
    },
  };
}

export async function getHistoricalProcessingContext(intakeId?: string): Promise<HistoricalProcessingContext> {
  if (!intakeId) return { present: false };
  const receipt = await listProcessingReceipts(intakeId).then((rows) => rows[0] ?? null);
  if (!receipt) return { present: false };
  return {
    present: true,
    processedAt: receipt.processedAt,
    matchedCount: receipt.matchedCount,
    newCandidateCount: receipt.newCandidateCount,
    heldCount: receipt.heldCount,
  };
}

export async function getLegacyReviewOverlayHints(operatorIds: string[]): Promise<Record<string, LegacyReviewOverlayHint>> {
  if (!operatorIds.length) return {};
  const resolverIds = new Set(loadResolverRegistryForUi().map((row) => row.id));
  const reviews = loadOperatorReviews();
  const reviewMap = new Map(reviews.map((row) => [row.operatorId, row]));
  const hints: Record<string, LegacyReviewOverlayHint> = {};

  for (const operatorId of operatorIds) {
    if (!resolverIds.has(operatorId)) continue;
    const review = reviewMap.get(operatorId);
    hints[operatorId] = review
      ? {
          operatorId,
          present: true,
          reviewState: review.reviewState,
          updatedAt: review.updatedAt,
        }
      : {
          operatorId,
          present: false,
        };
  }

  return hints;
}
