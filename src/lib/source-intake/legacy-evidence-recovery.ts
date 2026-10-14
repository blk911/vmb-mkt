import { createHash } from "node:crypto";
import type { ParsedCandidateRow, StagedOperatorEvidence } from "./types";

export type LegacyEvidenceRecoveryPlan = {
  status: "verified_plan_not_imported";
  archiveSha256: string;
  sourceDescription: string;
  allowedIntakeIds: string[];
  rowsToAppend: StagedOperatorEvidence[];
  alreadyPresentIds: string[];
  rejectedRows: Array<{ id: string; reason: string }>;
  sourceRows: number;
  destructiveChanges: 0;
};
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

/** Opt-in dry plan only. No filesystem reads, database writes, fixture import, or inferred scope. */
export function planLegacyEvidenceRecovery(
  input: { archiveText: string; expectedSha256: string; sourceDescription: string; allowedIntakeIds: string[] },
  candidates: Array<Pick<ParsedCandidateRow, "id" | "intakeId">>,
  existing: StagedOperatorEvidence[]
): LegacyEvidenceRecoveryPlan {
  if (!input.sourceDescription.trim() || !input.allowedIntakeIds.length || input.allowedIntakeIds.length > 100) throw new Error("legacy_evidence_explicit_scope_required");
  if (Buffer.byteLength(input.archiveText, "utf8") > 2_000_000) throw new Error("legacy_evidence_archive_too_large");
  const digest = createHash("sha256").update(input.archiveText).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(input.expectedSha256) || digest !== input.expectedSha256.toLowerCase()) throw new Error("legacy_evidence_archive_checksum_mismatch");
  const parsed: unknown = JSON.parse(input.archiveText);
  if (!Array.isArray(parsed) || parsed.length > 400) throw new Error("legacy_evidence_archive_row_limit");
  const allowed = new Set(input.allowedIntakeIds), keys = new Set(candidates.map((row) => JSON.stringify([row.intakeId, row.id])));
  const byId = new Map(existing.map((row) => [row.id, row])), seen = new Map<string, StagedOperatorEvidence>();
  const rowsToAppend: StagedOperatorEvidence[] = [], alreadyPresentIds: string[] = [], rejectedRows: LegacyEvidenceRecoveryPlan["rejectedRows"] = [];
  for (const value of parsed) {
    const row = value as StagedOperatorEvidence;
    if (!row || typeof row !== "object" || ["id", "intakeId", "candidateId", "factType", "factValue", "observedAt"].some((key) => typeof (row as Record<string, unknown>)[key] !== "string" || !(row as Record<string, string>)[key].trim()) || row.id.includes("/")) throw new Error("legacy_evidence_invalid_row");
    if (!allowed.has(row.intakeId) || !keys.has(JSON.stringify([row.intakeId, row.candidateId]))) { rejectedRows.push({ id: row.id, reason: "outside_explicit_existing_candidate_scope" }); continue; }
    const duplicate = seen.get(row.id), current = byId.get(row.id);
    if (duplicate && stable(duplicate) !== stable(row) || current && stable(current) !== stable(row)) throw new Error("legacy_evidence_id_conflict");
    if (duplicate) continue;
    seen.set(row.id, row);
    if (current) alreadyPresentIds.push(row.id);
    else rowsToAppend.push(structuredClone(row));
  }
  return { status: "verified_plan_not_imported", archiveSha256: digest, sourceDescription: input.sourceDescription.trim(), allowedIntakeIds: [...allowed].sort(), rowsToAppend, alreadyPresentIds, rejectedRows, sourceRows: parsed.length, destructiveChanges: 0 };
}
