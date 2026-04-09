import {
  appendStagedOperatorEvidence,
  createSourceIntakeId,
  getProcessingReceiptByIntakeId,
  getSourceIntakeById,
  listParsedCandidates,
  saveProcessingReceipt,
  updateSourceIntake,
  upsertOperatorCandidates,
} from "./store";
import { loadResolverRegistry } from "@/lib/resolver/registry-store";
import { computeIntakeDrift } from "./drift";
import { enqueueDoraValidationForCandidate } from "./dora-queue";
import { enqueueSocialDiscoveryForCandidate } from "./social-queue";
import type {
  IntakeCandidateProcessResult,
  IntakeProcessingReceipt,
  OperatorCandidateRecord,
  ParsedCandidateRow,
  ReviewAction,
  SourceIntakeRecord,
  StagedOperatorEvidence,
} from "./types";

function resolveAction(candidate: ParsedCandidateRow): ReviewAction {
  if (candidate.reviewAction && candidate.reviewAction !== "pending") return candidate.reviewAction;
  const disposition = candidate.suggestedMatch?.disposition;
  if (disposition === "matched") return "accept_match";
  if (disposition === "new_candidate") return "force_new";
  return "hold";
}

function buildEvidenceRows(
  intake: SourceIntakeRecord,
  candidate: ParsedCandidateRow,
  operatorId: string,
  observedAt: string
): StagedOperatorEvidence[] {
  const rows: StagedOperatorEvidence[] = [];
  const teamValue = intake.facilityName || intake.facilityId || intake.sourceLabel;
  rows.push({
    id: createSourceIntakeId("soe"),
    intakeId: intake.id,
    candidateId: candidate.id,
    operatorId,
    facilityId: intake.facilityId,
    sourceType: intake.sourceType,
    sourceLabel: intake.sourceLabel,
    sourceUrl: intake.sourceUrl,
    observedAt,
    candidateName: candidate.displayName,
    factType: "team_membership",
    factValue: teamValue,
    confidence: candidate.parseConfidence,
  });
  if (candidate.roleLabel) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: intake.id,
      candidateId: candidate.id,
      operatorId,
      facilityId: intake.facilityId,
      sourceType: intake.sourceType,
      sourceLabel: intake.sourceLabel,
      sourceUrl: intake.sourceUrl,
      observedAt,
      candidateName: candidate.displayName,
      factType: "role",
      factValue: candidate.roleLabel,
      confidence: candidate.parseConfidence,
    });
  }
  if (candidate.priceText) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: intake.id,
      candidateId: candidate.id,
      operatorId,
      facilityId: intake.facilityId,
      sourceType: intake.sourceType,
      sourceLabel: intake.sourceLabel,
      sourceUrl: intake.sourceUrl,
      observedAt,
      candidateName: candidate.displayName,
      factType: "price",
      factValue: candidate.priceText,
      confidence: candidate.parseConfidence,
    });
  }
  return rows;
}

function buildOperatorCandidate(
  intake: SourceIntakeRecord,
  candidate: ParsedCandidateRow,
  createdAt: string
): OperatorCandidateRecord {
  return {
    id: createSourceIntakeId("opc"),
    displayName: candidate.displayName,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    facilityId: intake.facilityId,
    facilityName: intake.facilityName,
    city: intake.city,
    state: intake.state,
    sourceIntakeId: intake.id,
    sourceLabel: intake.sourceLabel,
    sourceType: intake.sourceType,
    createdAt,
    status: "unresolved",
  };
}

function buildQueueItem(
  intake: SourceIntakeRecord,
  candidate: ParsedCandidateRow,
  createdAt: string
): {
  intakeId: string;
  candidateId: string;
  sourceLabel: string;
  sourceType: SourceIntakeRecord["sourceType"];
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
} {
  return {
    intakeId: intake.id,
    candidateId: candidate.id,
    sourceLabel: intake.sourceLabel,
    sourceType: intake.sourceType,
    sourceUrl: intake.sourceUrl,
    facilityId: intake.facilityId,
    facilityName: intake.facilityName,
    city: intake.city,
    state: intake.state,
    displayName: candidate.displayName,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
  };
}

export async function processSourceIntake(
  intakeId: string,
  options?: { processedBy?: string }
): Promise<IntakeProcessingReceipt> {
  const intake = await getSourceIntakeById(intakeId);
  if (!intake) throw new Error("source_intake_not_found");

  const existingReceipt = await getProcessingReceiptByIntakeId(intakeId);
  if (intake.status === "processed" && existingReceipt) {
    return existingReceipt;
  }

  const candidates = await listParsedCandidates(intakeId);
  if (!candidates.length) throw new Error("parsed_candidates_required");

  const processedAt = new Date().toISOString();
  const operatorsById = new Map(loadResolverRegistry().map((row) => [row.id, row]));
  const evidenceRows: StagedOperatorEvidence[] = [];
  const operatorCandidates: OperatorCandidateRecord[] = [];
  const candidateResults: IntakeCandidateProcessResult[] = [];

  let matchedCount = 0;
  let newCandidateCount = 0;
  let heldCount = 0;

  for (const candidate of candidates) {
    const action = resolveAction(candidate);
    if (action === "accept_match" && candidate.suggestedMatch?.matchedOperatorId) {
      const rows = buildEvidenceRows(intake, candidate, candidate.suggestedMatch.matchedOperatorId, processedAt);
      evidenceRows.push(...rows);
      const matchedOperator = operatorsById.get(candidate.suggestedMatch.matchedOperatorId);
      const missingDirectSurfaces = !matchedOperator?.canonicalInstagram || !matchedOperator?.canonicalBooking || !matchedOperator?.canonicalWebsite;
      if (missingDirectSurfaces) {
        await enqueueSocialDiscoveryForCandidate(buildQueueItem(intake, candidate, processedAt));
      }
      matchedCount += 1;
      candidateResults.push({
        candidateId: candidate.id,
        displayName: candidate.displayName,
        action: "matched",
        operatorId: candidate.suggestedMatch.matchedOperatorId,
        evidenceIds: rows.map((row) => row.id),
        notes: candidate.suggestedMatch.reasons,
      });
      continue;
    }

    if (action === "force_new") {
      const unresolved = buildOperatorCandidate(intake, candidate, processedAt);
      operatorCandidates.push(unresolved);
      const queueInput = buildQueueItem(intake, candidate, processedAt);
      await enqueueDoraValidationForCandidate(queueInput);
      await enqueueSocialDiscoveryForCandidate(queueInput);
      newCandidateCount += 1;
      candidateResults.push({
        candidateId: candidate.id,
        displayName: candidate.displayName,
        action: "new_candidate",
        createdCandidateId: unresolved.id,
        evidenceIds: [],
        notes: candidate.suggestedMatch?.reasons,
      });
      continue;
    }

    heldCount += 1;
    candidateResults.push({
      candidateId: candidate.id,
      displayName: candidate.displayName,
      action: "held",
      evidenceIds: [],
      notes: candidate.suggestedMatch?.reasons ?? ["held for manual review"],
    });
  }

  await appendStagedOperatorEvidence(evidenceRows);
  if (operatorCandidates.length) {
    await upsertOperatorCandidates(operatorCandidates);
  }

  const receipt: IntakeProcessingReceipt = {
    id: createSourceIntakeId("sir"),
    intakeId,
    processedAt,
    processedBy: options?.processedBy,
    evidenceCreated: evidenceRows.length,
    matchedCount,
    newCandidateCount,
    heldCount,
    candidateResults,
  };

  await saveProcessingReceipt(receipt);
  await updateSourceIntake(intakeId, {
    status: "processed",
    processSummary: {
      processedAt,
      evidenceCreated: evidenceRows.length,
      matchedCount,
      newCandidateCount,
      heldCount,
    },
  });
  await computeIntakeDrift(intakeId);

  return receipt;
}
