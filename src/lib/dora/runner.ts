import "server-only";
import { randomUUID } from "node:crypto";
import { loadSharedCatalog } from "@/lib/catalog/store";
import { fetchDoraCheck } from "./client";
import { emptyDoraCheck } from "./model";
import { catalogDoraSubjects, doraCatalogFingerprint, projectDoraCrossReference } from "./projection";
import { claimDoraRefresh, readDoraCrossReference, releaseDoraRefresh, saveDoraCrossReference } from "./store";
import type { DoraCheck, DoraCrossReference, DoraCrossReferenceRecord } from "./types";

/** Preserve previous observations on a failed recheck, without presenting them as current. */
function retainPriorEvidence(check: DoraCheck, prior?: DoraCheck): DoraCheck {
  if (!["blocked", "unavailable", "error"].includes(check.outcome) || !prior?.matches?.length) return check;
  return { ...prior, status: "review", outcome: check.outcome, attemptedAt: check.attemptedAt,
    reasons: [...check.reasons, "Latest attempt did not verify the source. Previous candidates and their original check dates are retained as stale evidence.", ...prior.reasons],
    matches: structuredClone(prior.matches), conflicts: [...prior.conflicts] };
}
export type DoraRefreshResult = { catalogId: string; status: "completed" | "cached" | "busy" | "skipped" | "error"; dora?: DoraCrossReference; error?: string; nextAttemptAt?: string };
export async function refreshCatalogDora(catalogIds: readonly string[]): Promise<DoraRefreshResult[]> {
  if (!Array.isArray(catalogIds) || !catalogIds.length || catalogIds.length > 10 || catalogIds.some((id) => typeof id !== "string" || id.length > 512 || !/^(provider:adminPipelineParsedCandidates:|business:tech_index:).+/.test(id) || /[\u0000-\u001f]/.test(id))) throw new Error("invalid_catalog_ids");
  const ids = [...new Set(catalogIds)], catalog = await loadSharedCatalog(), token = await claimDoraRefresh();
  if (!token) return ids.map((catalogId) => ({ catalogId, status: "busy", error: "A bounded DORA refresh is running or cooling down. Try again shortly." }));
  const results: DoraRefreshResult[] = [], deadline = Date.now() + 50_000;
  let blocked = false;
  try {
    for (const catalogId of ids) {
      const row = catalog.rows.find((row) => row.id === catalogId);
      if (!row) { results.push({ catalogId, status: "skipped", error: "Catalog source no longer exists." }); continue; }
      if (blocked || Date.now() >= deadline - 1000) { results.push({ catalogId, status: "skipped", error: blocked ? "Official source blocked access; remaining lookups were stopped." : "Batch time budget reached. Refresh remaining records separately." }); continue; }
      try {
        const fingerprint = doraCatalogFingerprint(row), prior = await readDoraCrossReference(catalogId);
        if (prior?.fingerprint === fingerprint && Date.parse(prior.nextAttemptAt) > Date.now()) {
          results.push({ catalogId, status: "cached", dora: projectDoraCrossReference(row, [prior]), nextAttemptAt: prior.nextAttemptAt }); continue;
        }
        const subjects = catalogDoraSubjects(row);
        let personLicense = row.entityType === "provider" ? await fetchDoraCheck(subjects.personLicense, {}, deadline) : emptyDoraCheck("Business/address records do not identify an individual license holder.");
        blocked = personLicense.outcome === "blocked";
        let shopRegistration = blocked ? { ...emptyDoraCheck("Official access blocked; remaining lookup stopped."), outcome: "blocked" as const }
          : await fetchDoraCheck(subjects.shopRegistration, {}, deadline);
        blocked ||= shopRegistration.outcome === "blocked";
        const previous = prior?.fingerprint === fingerprint ? projectDoraCrossReference(row, [prior]) : undefined;
        personLicense = retainPriorEvidence(personLicense, previous?.personLicense);
        shopRegistration = retainPriorEvidence(shopRegistration, previous?.shopRegistration);
        const now = new Date().toISOString();
        const failed = [personLicense, shopRegistration].some((check) => ["blocked", "unavailable", "error"].includes(check.outcome));
        const record: DoraCrossReferenceRecord = { schemaVersion: 1, catalogId, candidateKey: row.sourceIdentifiers?.candidateId && row.sourceIdentifiers?.intakeId ? JSON.stringify([row.sourceIdentifiers.intakeId, row.sourceIdentifiers.candidateId]) : undefined,
          fingerprint, runId: `dora_${randomUUID()}`, dora: { schemaVersion: 1, personLicense, shopRegistration }, completedAt: now,
          nextAttemptAt: new Date(Date.now() + (failed ? 15 * 60_000 : 24 * 60 * 60_000)).toISOString() };
        await saveDoraCrossReference(record, token);
        results.push({ catalogId, status: "completed", dora: projectDoraCrossReference(row, [record]), nextAttemptAt: record.nextAttemptAt });
      } catch { results.push({ catalogId, status: "error", error: "DORA refresh could not be safely completed or saved. Existing reviews are unchanged." }); }
    }
  } finally { await releaseDoraRefresh(token); }
  return results;
}
