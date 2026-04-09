import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import {
  findDoraResultByQueueItemId,
  getDoraQueueItemById,
  saveDoraResult,
  saveOperatorCandidateLink,
  upsertDoraQueueItem,
} from "./phase2-store";
import { scoreNameMatch } from "./matcher";
import { appendStagedOperatorEvidence, createSourceIntakeId, listOperatorCandidates, listParsedCandidates } from "./store";
import type { DoraMatchStatus, DoraValidationResult } from "./phase2-types";
import type { ParsedCandidateRow, StagedOperatorEvidence } from "./types";

type DoraLookupCandidate = {
  name: string;
  licenseNumber?: string;
  licenseType?: string;
  statusText?: string;
  city?: string;
  state?: string;
};

type DoraTechByIdRow = {
  licenseId?: string;
  name?: string;
  licenseType?: string;
  status?: string;
  city?: string;
  state?: string;
};

let doraCandidatesCache: Promise<DoraLookupCandidate[]> | null = null;

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function isInactiveStatus(statusText?: string): boolean {
  const text = normalizeText(statusText);
  if (!text) return false;
  return ["expired", "inactive", "revoked", "lapsed", "cancelled", "canceled", "denied"].some((token) =>
    text.includes(token)
  );
}

async function loadDoraCandidates(): Promise<DoraLookupCandidate[]> {
  if (!doraCandidatesCache) {
    doraCandidatesCache = (async () => {
      const abs = path.join(doraDenverDerivedAbs(), "tech_by_id.json");
      const raw = await fs.readFile(abs, "utf8");
      const parsed = JSON.parse(raw) as { techById?: Record<string, DoraTechByIdRow> };
      const rows = Object.values(parsed.techById || {});
      return rows
        .map((row) => ({
          name: row.name?.trim() || "",
          licenseNumber: row.licenseId?.trim() || undefined,
          licenseType: row.licenseType?.trim() || undefined,
          statusText: row.status?.trim() || undefined,
          city: row.city?.trim() || undefined,
          state: row.state?.trim() || undefined,
        }))
        .filter((row) => row.name);
    })();
  }
  return doraCandidatesCache;
}

export async function lookupDoraCandidates(args: {
  displayName: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
}): Promise<DoraLookupCandidate[]> {
  const rows = await loadDoraCandidates();
  const displayNorm = normalizeText(args.displayName);
  const lastNorm = normalizeText(args.lastName);
  const cityNorm = normalizeText(args.city);
  const filtered = rows.filter((row) => {
    const nameNorm = normalizeText(row.name);
    if (!nameNorm) return false;
    if (displayNorm && nameNorm.includes(displayNorm)) return true;
    if (lastNorm && nameNorm.includes(lastNorm)) return true;
    if (cityNorm && normalizeText(row.city) === cityNorm) return true;
    return false;
  });
  return filtered.slice(0, 250);
}

function buildReasons(candidate: DoraLookupCandidate, queueItem: Awaited<ReturnType<typeof getDoraQueueItemById>> extends infer T ? NonNullable<T> : never, score: number): string[] {
  const reasons: string[] = [];
  const nameScore = scoreNameMatch(queueItem.displayName, candidate.name);
  if (nameScore >= 100) reasons.push("exact full-name match against DORA tech record");
  else if (nameScore >= 96) reasons.push("strong first and last name alignment");
  else if (nameScore >= 84) reasons.push("last name and first-initial alignment");
  else if (nameScore >= 72) reasons.push("strong token overlap with DORA tech record");
  if (queueItem.city && normalizeText(queueItem.city) === normalizeText(candidate.city)) {
    reasons.push("same city as intake candidate");
  }
  if (queueItem.state && normalizeText(queueItem.state) === normalizeText(candidate.state)) {
    reasons.push("same state as intake candidate");
  }
  if (candidate.licenseType) reasons.push(`license type ${candidate.licenseType}`);
  if (candidate.statusText) reasons.push(`license status ${candidate.statusText}`);
  reasons.push(`resolver score ${score}`);
  return reasons;
}

function rankDoraCandidate(
  queueItem: Awaited<ReturnType<typeof getDoraQueueItemById>> extends infer T ? NonNullable<T> : never,
  candidate: DoraLookupCandidate
): { candidate: DoraLookupCandidate; score: number; reasons: string[] } {
  let score = scoreNameMatch(queueItem.displayName, candidate.name);
  if (queueItem.city && normalizeText(queueItem.city) === normalizeText(candidate.city)) score += 8;
  if (queueItem.state && normalizeText(queueItem.state) === normalizeText(candidate.state)) score += 4;
  if (queueItem.lastName && normalizeText(candidate.name).includes(normalizeText(queueItem.lastName))) score += 4;
  score = Math.min(100, score);
  return {
    candidate,
    score,
    reasons: buildReasons(candidate, queueItem, score),
  };
}

function deriveMatchStatus(
  ranked: Array<{ candidate: DoraLookupCandidate; score: number }>
): DoraMatchStatus {
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 70) return "not_found";
  if (second && top.score >= 78 && second.score >= 78 && Math.abs(top.score - second.score) <= 4) {
    return "possible_match";
  }
  if (top.score >= 92) {
    return isInactiveStatus(top.candidate.statusText) ? "inactive_match" : "active_match";
  }
  return "possible_match";
}

async function candidateRowForQueue(intakeId: string, candidateId: string): Promise<ParsedCandidateRow | null> {
  const rows = await listParsedCandidates(intakeId);
  return rows.find((row) => row.id === candidateId) ?? null;
}

async function maybeSaveLinkSuggestion(
  candidate: ParsedCandidateRow | null,
  intakeId: string,
  result: DoraValidationResult
): Promise<void> {
  if (result.status === "not_found" || result.score < 84) return;

  if (candidate?.suggestedMatch?.matchedOperatorId && result.score >= 90) {
    await saveOperatorCandidateLink({
      id: createSourceIntakeId("ocl"),
      candidateId: result.candidateId,
      targetType: "operator",
      targetId: candidate.suggestedMatch.matchedOperatorId,
      score: result.score,
      reasons: [...result.reasons, "DORA validation strengthens existing operator suggestion"],
      createdAt: result.resolvedAt,
    });
    return;
  }

  const unresolvedCandidates = await listOperatorCandidates();
  const unresolved = unresolvedCandidates.find(
    (row) => row.sourceIntakeId === intakeId && normalizeText(row.displayName) === normalizeText(candidate?.displayName)
  );
  if (unresolved) {
    await saveOperatorCandidateLink({
      id: createSourceIntakeId("ocl"),
      candidateId: result.candidateId,
      targetType: "operator_candidate",
      targetId: unresolved.id,
      score: result.score,
      reasons: [...result.reasons, "DORA validation strengthens unresolved operator candidate identity"],
      createdAt: result.resolvedAt,
    });
  }
}

async function writeDoraEvidence(
  queueItem: Awaited<ReturnType<typeof getDoraQueueItemById>> extends infer T ? NonNullable<T> : never,
  matched: DoraLookupCandidate,
  parsedCandidate: ParsedCandidateRow | null,
  resolvedAt: string
): Promise<StagedOperatorEvidence[]> {
  const operatorId = parsedCandidate?.suggestedMatch?.matchedOperatorId;
  const rows: StagedOperatorEvidence[] = [];
  if (matched.statusText) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      operatorId,
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: queueItem.sourceUrl,
      observedAt: resolvedAt,
      candidateName: queueItem.displayName,
      factType: "license_status",
      factValue: matched.statusText,
      confidence: "high",
    });
  }
  if (matched.licenseNumber) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      operatorId,
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: queueItem.sourceUrl,
      observedAt: resolvedAt,
      candidateName: queueItem.displayName,
      factType: "license_number",
      factValue: matched.licenseNumber,
      confidence: "high",
    });
  }
  if (matched.licenseType) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      operatorId,
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: queueItem.sourceUrl,
      observedAt: resolvedAt,
      candidateName: queueItem.displayName,
      factType: "license_type",
      factValue: matched.licenseType,
      confidence: "medium",
    });
  }
  if (matched.city) {
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      operatorId,
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: queueItem.sourceUrl,
      observedAt: resolvedAt,
      candidateName: queueItem.displayName,
      factType: "license_city",
      factValue: matched.city,
      confidence: "medium",
    });
  }
  if (rows.length) {
    await appendStagedOperatorEvidence(rows);
  }
  return rows;
}

export async function resolveDoraQueueItem(
  queueItemId: string,
  _options?: { resolvedBy?: string }
): Promise<DoraValidationResult> {
  const existing = await findDoraResultByQueueItemId(queueItemId);
  if (existing) return existing;

  const queueItem = await getDoraQueueItemById(queueItemId);
  if (!queueItem) throw new Error("dora_queue_item_not_found");

  const startedAt = new Date().toISOString();
  await upsertDoraQueueItem({
    ...queueItem,
    status: "processing",
    attempts: queueItem.attempts + 1,
    lastAttemptAt: startedAt,
  });

  try {
    const doraCandidates = await lookupDoraCandidates({
      displayName: queueItem.displayName,
      firstName: queueItem.firstName,
      lastName: queueItem.lastName,
      city: queueItem.city,
      state: queueItem.state,
    });
    const ranked = doraCandidates
      .map((candidate) => rankDoraCandidate(queueItem, candidate))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const top = ranked[0];
    const status = deriveMatchStatus(ranked);
    const resolvedAt = new Date().toISOString();
    const parsedCandidate = await candidateRowForQueue(queueItem.intakeId, queueItem.candidateId);
    const evidenceRows =
      top && (status === "active_match" || status === "inactive_match")
        ? await writeDoraEvidence(queueItem, top.candidate, parsedCandidate, resolvedAt)
        : [];

    const result: DoraValidationResult = {
      id: createSourceIntakeId("dvr"),
      queueItemId: queueItem.id,
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      resolvedAt,
      status,
      matchedLicenseName: top?.candidate.name,
      matchedLicenseNumber: top?.candidate.licenseNumber,
      licenseType: top?.candidate.licenseType,
      licenseStatusText: top?.candidate.statusText,
      city: top?.candidate.city,
      state: top?.candidate.state,
      score: top?.score ?? 0,
      reasons:
        top?.reasons ??
        ["no credible DORA candidate found for this intake candidate"],
      evidenceIds: evidenceRows.map((row) => row.id),
    };

    await saveDoraResult(result);
    await maybeSaveLinkSuggestion(parsedCandidate, queueItem.intakeId, result);
    await upsertDoraQueueItem({
      ...queueItem,
      status: "resolved",
      attempts: queueItem.attempts + 1,
      lastAttemptAt: startedAt,
    });
    return result;
  } catch (error) {
    await upsertDoraQueueItem({
      ...queueItem,
      status: "failed",
      attempts: queueItem.attempts + 1,
      lastAttemptAt: startedAt,
    });
    throw error;
  }
}
