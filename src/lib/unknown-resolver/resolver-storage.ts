import type { ResolverDecision, UnknownResolverRecord } from "./resolver-types";
import { HOUSE_CLEANING_CANDIDATES_BY_RECORD } from "@/lib/mock/unknownResolver/houseCleaningCandidates";
import { HOUSE_CLEANING_QUEUE_SEED } from "@/lib/mock/unknownResolver/houseCleaningQueue";

let queueOverride: UnknownResolverRecord[] | null = null;

/** Future: Firestore / API. For v1 returns in-memory or seed. */
export function loadUnknownResolverQueue(): UnknownResolverRecord[] {
  return queueOverride ?? [...HOUSE_CLEANING_QUEUE_SEED];
}

export function loadUnknownResolverCandidates(recordId: string) {
  return [...(HOUSE_CLEANING_CANDIDATES_BY_RECORD[recordId] ?? [])];
}

/** Persist operator decision; v1 keeps memory copy for session. */
export function saveOperatorDecision(
  recordId: string,
  decision: ResolverDecision,
  note: string | null
): UnknownResolverRecord | null {
  const q = loadUnknownResolverQueue();
  const idx = q.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const updated: UnknownResolverRecord = {
    ...q[idx],
    operatorDecision: decision,
    operatorNote: note?.trim() || null,
    status: "reviewed",
    updatedAt: now,
  };
  const next = [...q];
  next[idx] = updated;
  queueOverride = next;
  return updated;
}

/** Test / reset helper */
export function resetUnknownResolverQueueForTests(): void {
  queueOverride = null;
}
