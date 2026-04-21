import { getSourceIntakeById, listParsedCandidates } from "@/lib/source-intake/store";
import {
  findDoraResultByQueueItemId,
  findSocialResultByQueueItemId,
  getDoraQueueItemById,
  getSocialQueueItemById,
  listDoraQueue,
  listSocialQueue,
} from "@/lib/source-intake/phase2-store";
import type { ParsedCandidateRow, SourceIntakeRecord } from "@/lib/source-intake/types";
import type { DoraValidationResult, SocialDiscoveryResult } from "@/lib/source-intake/phase2-types";
import { getHistoricalProcessingContext } from "./reconciliation";
import type { ValidationDetail, ValidationQueueRow } from "./types";

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
      } satisfies ValidationQueueRow;
    })
  );

  return [...doraRows, ...socialRows].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function doraResultSummary(result: DoraValidationResult): ValidationDetail["resultSummary"] {
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

function socialResultSummary(result: SocialDiscoveryResult): ValidationDetail["resultSummary"] {
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

export async function getValidationDetail(queueItemId: string): Promise<ValidationDetail | null> {
  const doraItem = await getDoraQueueItemById(queueItemId);
  if (doraItem) {
    const [candidateList, intake, result, historicalProcessing] = await Promise.all([
      listParsedCandidates(doraItem.intakeId),
      getSourceIntakeById(doraItem.intakeId),
      findDoraResultByQueueItemId(queueItemId),
      getHistoricalProcessingContext(doraItem.intakeId),
    ]);
    const candidate = candidateList.find((row) => row.id === doraItem.candidateId);
    const confidence = normalizeConfidence(candidate, result?.score);
    return {
      row: {
        queueItemId: doraItem.id,
        intakeId: doraItem.intakeId,
        candidateId: doraItem.candidateId,
        displayName: doraItem.displayName,
        city: doraItem.city,
        state: doraItem.state,
        sourceLabel: doraItem.sourceLabel,
        sourceUrl: doraItem.sourceUrl,
        sourceType: "DORA",
        status: resultStatus(result) || doraItem.status,
        confidence: confidence.label,
        confidenceScore: confidence.score,
        createdAt: doraItem.createdAt,
        resolvedAt: result?.resolvedAt,
      },
      resolveEndpoint: `/api/source-intake/dora-queue/${encodeURIComponent(queueItemId)}/resolve`,
      candidate: candidate
        ? {
            displayName: candidate.displayName,
            roleLabel: candidate.roleLabel,
            priceText: candidate.priceText,
            parseConfidence: candidate.parseConfidence,
            parseWarnings: candidate.parseWarnings,
            rawBlock: candidate.rawBlock,
          }
        : undefined,
      intake: toIntakeSummary(intake),
      resultSummary: result ? doraResultSummary(result) : undefined,
      historicalProcessing,
    };
  }

  const socialItem = await getSocialQueueItemById(queueItemId);
  if (!socialItem) return null;

  const [candidateList, intake, result, historicalProcessing] = await Promise.all([
    listParsedCandidates(socialItem.intakeId),
    getSourceIntakeById(socialItem.intakeId),
    findSocialResultByQueueItemId(queueItemId),
    getHistoricalProcessingContext(socialItem.intakeId),
  ]);
  const candidate = candidateList.find((row) => row.id === socialItem.candidateId);
  const confidence = normalizeConfidence(candidate);
  return {
    row: {
      queueItemId: socialItem.id,
      intakeId: socialItem.intakeId,
      candidateId: socialItem.candidateId,
      displayName: socialItem.displayName,
      city: socialItem.city,
      state: socialItem.state,
      sourceLabel: socialItem.sourceLabel,
      sourceUrl: socialItem.sourceUrl,
      sourceType: "SOCIAL",
      status: resultStatus(result) || socialItem.status,
      confidence: confidence.label,
      confidenceScore: confidence.score,
      createdAt: socialItem.createdAt,
      resolvedAt: result?.resolvedAt,
    },
    resolveEndpoint: `/api/source-intake/social-queue/${encodeURIComponent(queueItemId)}/resolve`,
    candidate: candidate
      ? {
          displayName: candidate.displayName,
          roleLabel: candidate.roleLabel,
          priceText: candidate.priceText,
          parseConfidence: candidate.parseConfidence,
          parseWarnings: candidate.parseWarnings,
          rawBlock: candidate.rawBlock,
        }
      : undefined,
    intake: toIntakeSummary(intake),
    resultSummary: result ? socialResultSummary(result) : undefined,
    historicalProcessing,
  };
}
