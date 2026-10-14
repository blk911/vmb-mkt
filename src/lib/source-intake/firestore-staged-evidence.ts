import "server-only";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import { sameStagedEvidence } from "./evidence-identity";
import type { StagedOperatorEvidence } from "./types";

export const STAGED_EVIDENCE_COLLECTION = "adminPipelineOperatorEvidence";
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function validateStagedEvidenceRow(row: StagedOperatorEvidence): void {
  for (const field of ["id", "intakeId", "candidateId", "factType", "factValue", "observedAt"] as const) {
    if (typeof row[field] !== "string" || !row[field].trim()) throw new Error(`invalid_staged_evidence_${field}`);
  }
  if (row.id.includes("/") || row.id.length > 1400) throw new Error("invalid_staged_evidence_id");
}

export async function firestoreListStagedOperatorEvidence(): Promise<StagedOperatorEvidence[]> {
  const snapshot = await adminDb().collection(STAGED_EVIDENCE_COLLECTION).get();
  return snapshot.docs.map((doc) => doc.data() as StagedOperatorEvidence).sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id));
}

/** Append-only by raw evidence ID: retries are idempotent, collisions fail closed, no facts or decisions are deleted. */
export async function firestoreAppendStagedOperatorEvidence(rows: StagedOperatorEvidence[]): Promise<StagedOperatorEvidence[]> {
  if (rows.length > 10_000) throw new Error("staged_evidence_batch_limit");
  const unique = new Map<string, StagedOperatorEvidence>();
  for (const row of rows) {
    validateStagedEvidenceRow(row);
    const previous = unique.get(row.id);
    if (previous && !sameStagedEvidence(previous, row)) throw new Error("staged_evidence_id_conflict");
    if (!previous) unique.set(row.id, clean(row));
  }
  if (unique.size) {
    const db = adminDb(), all = [...unique.values()];
    for (let offset = 0; offset < all.length; offset += 400) {
    const entries = all.slice(offset, offset + 400);
    await db.runTransaction(async (tx) => {
      const refs = entries.map((row) => db.collection(STAGED_EVIDENCE_COLLECTION).doc(row.id));
      const snapshots = await tx.getAll(...refs);
      snapshots.forEach((snapshot, index) => {
        if (snapshot.exists && !sameStagedEvidence(snapshot.data() as StagedOperatorEvidence, entries[index])) throw new Error("staged_evidence_id_conflict");
      });
      snapshots.forEach((snapshot, index) => { if (!snapshot.exists) tx.create(refs[index], entries[index]); });
    });
    }
  }
  return firestoreListStagedOperatorEvidence();
}
