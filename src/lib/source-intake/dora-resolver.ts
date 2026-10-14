import { emptyDoraCrossReference } from "@/lib/dora/model";
import { loadSharedCatalog } from "@/lib/catalog/store";
import { refreshCatalogDora } from "@/lib/dora/runner";
import { safeDoraValidationStatus } from "@/lib/dora/projection";
import { findDoraResultByQueueItemId, getDoraQueueItemById, saveDoraResult, upsertDoraQueueItem } from "./phase2-store";
import { createSourceIntakeId, listParsedCandidates } from "./store";
import type { DoraMatchStatus, DoraValidationResult, ValidationReviewOutcome } from "./phase2-types";
import type { ParsedCandidateRow } from "./types";

function targetOperatorId(candidate: ParsedCandidateRow | null, mergeTargetId?: string): string | undefined {
  return mergeTargetId?.trim() || candidate?.suggestedMatch?.matchedOperatorId || undefined;
}

/** Manual review is independent of licensing; this never creates an operator or outreach/list entry. */
export async function resolveDoraQueueItem(
  queueItemId: string,
  options?: { resolvedBy?: string; action?: ValidationReviewOutcome; mergeTargetId?: string }
): Promise<DoraValidationResult> {
  const queueItem = await getDoraQueueItemById(queueItemId);
  if (!queueItem) throw new Error("dora_queue_item_not_found");
  const [existing, candidates] = await Promise.all([findDoraResultByQueueItemId(queueItemId), listParsedCandidates(queueItem.intakeId)]);
  const candidate = candidates.find((row) => row.id === queueItem.candidateId) || null;
  if (existing && !options?.action) return { ...existing, status: safeDoraValidationStatus(existing) as DoraMatchStatus };
  let result = existing;
  if (!result && options?.action) {
    result = { id: createSourceIntakeId("dvr"), queueItemId: queueItem.id, intakeId: queueItem.intakeId, candidateId: queueItem.candidateId,
      resolvedAt: new Date().toISOString(), status: "not_checked", dora: emptyDoraCrossReference(), score: 0, evidenceIds: [],
      reasons: ["Manual review recorded without making a licensing claim. Official DORA evidence has not been checked."], targetOperatorId: targetOperatorId(candidate) };
  }
  // An explicit review of an existing result does not need a new source check.
  if (!result) {
    const catalog = await loadSharedCatalog();
    const rows = catalog.rows.filter((row) => row.entityType === "provider" && row.sourceIdentifiers?.candidateId === queueItem.candidateId && row.sourceIdentifiers?.intakeId === queueItem.intakeId);
    if (rows.length !== 1) throw new Error("dora_exact_catalog_identity_required");
    const refreshed = (await refreshCatalogDora([rows[0].id]))[0];
    if (!refreshed?.dora || !["completed", "cached"].includes(refreshed.status)) throw new Error("dora_refresh_unavailable");
    const dora = refreshed.dora, check = dora.personLicense, match = check.matches.length === 1 ? check.matches[0] : undefined;
    const status: DoraMatchStatus = check.status === "active" ? "active_match" : check.status === "expired" ? "inactive_match"
      : check.outcome === "no_match" ? "not_found" : check.matches.length ? "possible_match" : "not_checked";
    result = {
      ...existing,
      id: existing?.id || createSourceIntakeId("dvr"), queueItemId: queueItem.id, intakeId: queueItem.intakeId, candidateId: queueItem.candidateId,
      resolvedAt: new Date().toISOString(), status, dora, catalogId: rows[0].id,
      matchedLicenseName: match?.name, matchedLicenseNumber: match?.licenseNumber, licenseType: match?.licenseType,
      licenseStatusText: match?.statusText, city: match?.city, state: match?.state, sourceUrl: match?.sourceUrl || check.sourceUrl,
      // This compatibility field is never an independent identity claim.
      score: match?.identity === "corroborated" ? 100 : 0,
      reasons: [...check.reasons, ...check.conflicts, ...(match?.basis || []), ...(match?.conflicts || [])],
      evidenceIds: existing?.evidenceIds || [], targetOperatorId: existing?.targetOperatorId || targetOperatorId(candidate),
      ...(!existing?.dora && existing?.status ? { legacyStatus: existing.status } : {}),
    };
  } else {
    const safeStatus = safeDoraValidationStatus(result) as DoraMatchStatus;
    if (safeStatus !== result.status) result = { ...result, legacyStatus: result.legacyStatus || result.status, status: safeStatus };
  }
  if (options?.action) {
    result = { ...result, finalStatus: options.action, mergeTargetId: options.action === "merged" ? options.mergeTargetId?.trim() : undefined,
      reviewedAt: new Date().toISOString(), reviewedBy: options.resolvedBy, targetOperatorId: targetOperatorId(candidate, options.mergeTargetId) };
  }
  await saveDoraResult(result);
  await upsertDoraQueueItem({ ...queueItem, status: options?.action || result.finalStatus || (["approved", "rejected", "merged", "dismissed"].includes(queueItem.status) ? queueItem.status : "resolved"),
    attempts: queueItem.attempts + (options?.action && existing ? 0 : 1), lastAttemptAt: options?.action && existing ? queueItem.lastAttemptAt : new Date().toISOString() });
  return result;
}
