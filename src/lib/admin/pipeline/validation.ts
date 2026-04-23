import { getSourceIntakeById, listParsedCandidates } from "@/lib/source-intake/store";
import {
  findDoraResultByQueueItemId,
  findSocialResultByQueueItemId,
  listDoraQueue,
  listSocialQueue,
} from "@/lib/source-intake/phase2-store";
import type { ParsedCandidateRow, SourceIntakeRecord } from "@/lib/source-intake/types";
import type { DoraValidationResult, SocialDiscoveryResult } from "@/lib/source-intake/phase2-types";
import { getHistoricalProcessingContext } from "./reconciliation";
import type { ValidationDetail, ValidationLaneDetail, ValidationQueueRow, ValidationReviewRow } from "./types";

const TERMINAL_VALIDATION_STATUSES = new Set(["approved", "merged", "rejected", "failed", "dismissed"]);
const VALIDATION_LANE_ORDER: Record<ValidationQueueRow["sourceType"], number> = {
  DORA: 0,
  SOCIAL: 1,
};

function confidenceToScore(confidence?: string): number | undefined {
  if (!confidence) return undefined;
  if (confidence === "high") return 90;
  if (confidence === "medium") return 70;
  if (confidence === "low") return 50;
  const parsed = Number(confidence);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeConfidence(candidate?: ParsedCandidateRow, fallbackScore?: number): { label: string; score?: number } {
  if (candidate?.parseConfidence) {
    return {
      label: candidate.parseConfidence.toUpperCase(),
      score: confidenceToScore(candidate.parseConfidence),
    };
  }
  if (typeof fallbackScore === "number") {
    return {
      label: `${fallbackScore}`,
      score: fallbackScore,
    };
  }
  return { label: "UNKNOWN" };
}

function resultStatus(result?: DoraValidationResult | SocialDiscoveryResult | null): string | undefined {
  if (!result) return undefined;
  if ("finalStatus" in result && result.finalStatus) return result.finalStatus;
  if ("status" in result) return result.status;
  return result.discoveredSurfaces.length ? "resolved" : "queued";
}

function buildValidationReviewKey(intakeId: string, candidateId: string): string {
  return `${intakeId}::${candidateId}`;
}

function parseValidationReviewKey(value: string): { intakeId: string; candidateId: string } | null {
  const separatorIndex = value.indexOf("::");
  if (separatorIndex <= 0) return null;
  const intakeId = value.slice(0, separatorIndex);
  const candidateId = value.slice(separatorIndex + 2);
  if (!intakeId || !candidateId) return null;
  return { intakeId, candidateId };
}

function isPendingValidationStatus(status: string): boolean {
  return !TERMINAL_VALIDATION_STATUSES.has(status);
}

function compareIsoDesc(left?: string, right?: string): number {
  return (right || "").localeCompare(left || "");
}

function combineLaneStatuses(rows: ValidationQueueRow[]): string {
  const parts = rows
    .sort((left, right) => VALIDATION_LANE_ORDER[left.sourceType] - VALIDATION_LANE_ORDER[right.sourceType])
    .map((row) => `${row.sourceType}: ${row.status}`);
  return parts.join(" · ");
}

function combineValidationReviewRow(rows: ValidationQueueRow[]): ValidationReviewRow {
  const orderedRows = [...rows].sort((left, right) => {
    const byCreatedAt = compareIsoDesc(left.createdAt, right.createdAt);
    if (byCreatedAt !== 0) return byCreatedAt;
    return VALIDATION_LANE_ORDER[left.sourceType] - VALIDATION_LANE_ORDER[right.sourceType];
  });
  const baseRow = orderedRows[0];
  const bestConfidenceRow =
    [...orderedRows]
      .filter((row) => typeof row.confidenceScore === "number")
      .sort((left, right) => (right.confidenceScore || 0) - (left.confidenceScore || 0))[0] || baseRow;
  const laneStatuses = orderedRows.reduce<ValidationReviewRow["laneStatuses"]>((acc, row) => {
    acc[row.sourceType] = row.status;
    return acc;
  }, {});
  const lanes = [...new Set(orderedRows.map((row) => row.sourceType))].sort(
    (left, right) => VALIDATION_LANE_ORDER[left] - VALIDATION_LANE_ORDER[right]
  );
  return {
    reviewKey: buildValidationReviewKey(baseRow.intakeId, baseRow.candidateId),
    intakeId: baseRow.intakeId,
    candidateId: baseRow.candidateId,
    displayName: baseRow.displayName,
    city: orderedRows.map((row) => row.city).find(Boolean),
    state: orderedRows.map((row) => row.state).find(Boolean),
    sourceLabel: baseRow.sourceLabel,
    sourceUrl: orderedRows.map((row) => row.sourceUrl).find(Boolean),
    status: combineLaneStatuses(orderedRows),
    confidence: bestConfidenceRow.confidence,
    confidenceScore: bestConfidenceRow.confidenceScore,
    createdAt: orderedRows.map((row) => row.createdAt).sort((left, right) => compareIsoDesc(left, right))[0] || baseRow.createdAt,
    resolvedAt: orderedRows.map((row) => row.resolvedAt).filter(Boolean).sort((left, right) => compareIsoDesc(left, right))[0],
    instagramHandle: baseRow.instagramHandle,
    instagramProfileUrl: baseRow.instagramProfileUrl,
    captionSnippet: baseRow.captionSnippet,
    signalType: baseRow.signalType,
    serviceHint: baseRow.serviceHint,
    geoHint: baseRow.geoHint,
    lanes,
    laneStatuses,
  };
}

export async function listPendingValidationReviewRows(): Promise<ValidationReviewRow[]> {
  const pendingRows = (await listValidationRows()).filter((row) => isPendingValidationStatus(row.status));
  const groupedRows = new Map<string, ValidationQueueRow[]>();
  for (const row of pendingRows) {
    const reviewKey = buildValidationReviewKey(row.intakeId, row.candidateId);
    const current = groupedRows.get(reviewKey) || [];
    current.push(row);
    groupedRows.set(reviewKey, current);
  }
  return [...groupedRows.values()]
    .map((rows) => combineValidationReviewRow(rows))
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

async function buildLaneDetail(row: ValidationQueueRow): Promise<ValidationLaneDetail> {
  if (row.sourceType === "DORA") {
    const result = await findDoraResultByQueueItemId(row.queueItemId);
    return {
      queueItemId: row.queueItemId,
      sourceType: row.sourceType,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolveEndpoint: `/api/source-intake/dora-queue/${encodeURIComponent(row.queueItemId)}/resolve`,
      resultSummary: result ? doraResultSummary(result) : undefined,
    };
  }
  const result = await findSocialResultByQueueItemId(row.queueItemId);
  return {
    queueItemId: row.queueItemId,
    sourceType: row.sourceType,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolveEndpoint: `/api/source-intake/social-queue/${encodeURIComponent(row.queueItemId)}/resolve`,
    resultSummary: result ? socialResultSummary(result) : undefined,
  };
}

export async function listValidationRows(): Promise<ValidationQueueRow[]> {
  const [doraQueue, socialQueue] = await Promise.all([listDoraQueue(), listSocialQueue()]);
  const intakeIds = [...new Set([...doraQueue, ...socialQueue].map((row) => row.intakeId))];

  const candidatesByKey = new Map<string, ParsedCandidateRow>();
  await Promise.all(
    intakeIds.map(async (intakeId) => {
      const candidates = await listParsedCandidates(intakeId);
      for (const candidate of candidates) {
        candidatesByKey.set(`${candidate.intakeId}:${candidate.id}`, candidate);
      }
    })
  );

  const doraRows = await Promise.all(
    doraQueue.map(async (item) => {
      const [result] = await Promise.all([findDoraResultByQueueItemId(item.id)]);
      const candidate = candidatesByKey.get(`${item.intakeId}:${item.candidateId}`);
      const confidence = normalizeConfidence(candidate, result?.score);
      return {
        queueItemId: item.id,
        intakeId: item.intakeId,
        candidateId: item.candidateId,
        displayName: item.displayName,
        city: item.city,
        state: item.state,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        sourceType: "DORA" as const,
        status: resultStatus(result) || item.status,
        confidence: confidence.label,
        confidenceScore: confidence.score,
        createdAt: item.createdAt,
        resolvedAt: result?.resolvedAt,
        instagramHandle: candidate?.instagramHandle,
        instagramProfileUrl: candidate?.instagramProfileUrl,
        captionSnippet: candidate?.captionSnippet,
        signalType: candidate?.signalType,
        serviceHint: candidate?.serviceHint,
        geoHint: candidate?.geoHint,
      } satisfies ValidationQueueRow;
    })
  );

  const socialRows = await Promise.all(
    socialQueue.map(async (item) => {
      const [result] = await Promise.all([findSocialResultByQueueItemId(item.id)]);
      const candidate = candidatesByKey.get(`${item.intakeId}:${item.candidateId}`);
      const confidence = normalizeConfidence(candidate);
      return {
        queueItemId: item.id,
        intakeId: item.intakeId,
        candidateId: item.candidateId,
        displayName: item.displayName,
        city: item.city,
        state: item.state,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        sourceType: "SOCIAL" as const,
        status: resultStatus(result) || item.status,
        confidence: confidence.label,
        confidenceScore: confidence.score,
        createdAt: item.createdAt,
        resolvedAt: result?.resolvedAt,
        instagramHandle: candidate?.instagramHandle,
        instagramProfileUrl: candidate?.instagramProfileUrl,
        captionSnippet: candidate?.captionSnippet,
        signalType: candidate?.signalType,
        serviceHint: candidate?.serviceHint,
        geoHint: candidate?.geoHint,
      } satisfies ValidationQueueRow;
    })
  );

  return [...doraRows, ...socialRows].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function doraResultSummary(result: DoraValidationResult): ValidationLaneDetail["resultSummary"] {
  return {
    title: "DORA Resolution",
    lines: [
      `status: ${result.status}`,
      ...(result.finalStatus ? [`review: ${result.finalStatus}`] : []),
      ...(result.mergeTargetId ? [`mergeTargetId: ${result.mergeTargetId}`] : []),
      `score: ${result.score}`,
      ...(result.matchedLicenseNumber ? [`license: ${result.matchedLicenseNumber}`] : []),
      ...result.reasons,
    ],
  };
}

function socialResultSummary(result: SocialDiscoveryResult): ValidationLaneDetail["resultSummary"] {
  return {
    title: "Social Resolution",
    lines: [
      ...(result.finalStatus ? [`review: ${result.finalStatus}`] : []),
      ...(result.mergeTargetId ? [`mergeTargetId: ${result.mergeTargetId}`] : []),
      ...(result.discoveredSurfaces.length
        ? result.discoveredSurfaces.map((surface) => `${surface.type}: ${surface.value} (${surface.confidence})`)
        : ["No surfaces discovered yet."]),
    ],
  };
}

function toIntakeSummary(intake: SourceIntakeRecord | null): ValidationDetail["intake"] | undefined {
  if (!intake) return undefined;
  return {
    id: intake.id,
    sourceLabel: intake.sourceLabel,
    sourceType: intake.sourceType,
    sourceUrl: intake.sourceUrl,
    status: intake.status,
    submittedAt: intake.submittedAt,
  };
}

export async function getValidationDetail(reviewKeyOrQueueItemId: string): Promise<ValidationDetail | null> {
  const validationRows = await listValidationRows();
  const matchedQueueRow = validationRows.find((row) => row.queueItemId === reviewKeyOrQueueItemId);
  const keyParts = matchedQueueRow
    ? {
        intakeId: matchedQueueRow.intakeId,
        candidateId: matchedQueueRow.candidateId,
      }
    : parseValidationReviewKey(reviewKeyOrQueueItemId);
  if (!keyParts) return null;

  const laneRows = validationRows
    .filter((row) => row.intakeId === keyParts.intakeId && row.candidateId === keyParts.candidateId)
    .sort((left, right) => VALIDATION_LANE_ORDER[left.sourceType] - VALIDATION_LANE_ORDER[right.sourceType]);
  if (!laneRows.length) return null;

  const [candidateList, intake, historicalProcessing, lanes] = await Promise.all([
    listParsedCandidates(keyParts.intakeId),
    getSourceIntakeById(keyParts.intakeId),
    getHistoricalProcessingContext(keyParts.intakeId),
    Promise.all(laneRows.map((row) => buildLaneDetail(row))),
  ]);
  const candidate = candidateList.find((row) => row.id === keyParts.candidateId);

  return {
    row: combineValidationReviewRow(laneRows),
    lanes,
    candidate: candidate
      ? {
          displayName: candidate.displayName,
          roleLabel: candidate.roleLabel,
          priceText: candidate.priceText,
          parseConfidence: candidate.parseConfidence,
          parseWarnings: candidate.parseWarnings,
          rawBlock: candidate.rawBlock,
          instagramHandle: candidate.instagramHandle,
          instagramProfileUrl: candidate.instagramProfileUrl,
          captionSnippet: candidate.captionSnippet,
          signalType: candidate.signalType,
          serviceHint: candidate.serviceHint,
          geoHint: candidate.geoHint,
        }
      : undefined,
    intake: toIntakeSummary(intake),
    historicalProcessing,
  };
}
