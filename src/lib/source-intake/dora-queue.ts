import { getDoraQueueItemById, listDoraQueue, listDoraResults, upsertDoraQueueItem } from "./phase2-store";
import { createSourceIntakeId } from "./store";
import type { DoraValidationQueueItem } from "./phase2-types";
import type { SourceType } from "./types";

function sameScope(
  row: DoraValidationQueueItem,
  input: {
    intakeId: string;
    candidateId: string;
    displayName: string;
  }
): boolean {
  return (
    row.intakeId === input.intakeId &&
    row.candidateId === input.candidateId &&
    row.displayName.trim().toLowerCase() === input.displayName.trim().toLowerCase()
  );
}

export async function enqueueDoraValidationForCandidate(args: {
  intakeId: string;
  candidateId: string;
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl?: string;
  facilityId?: string;
  facilityName?: string;
  city?: string;
  state?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
}): Promise<DoraValidationQueueItem> {
  const [queue, results] = await Promise.all([listDoraQueue(), listDoraResults()]);
  const existing = queue.find((row) => sameScope(row, args));
  if (existing) {
    const hasResolved = results.some((result) => result.queueItemId === existing.id);
    if (existing.status !== "dismissed" || hasResolved) return existing;
  }

  const item: DoraValidationQueueItem = {
    id: createSourceIntakeId("dq"),
    intakeId: args.intakeId,
    candidateId: args.candidateId,
    sourceLabel: args.sourceLabel,
    sourceType: args.sourceType,
    sourceUrl: args.sourceUrl,
    facilityId: args.facilityId,
    facilityName: args.facilityName,
    city: args.city,
    state: args.state,
    displayName: args.displayName,
    firstName: args.firstName,
    lastName: args.lastName,
    createdAt: new Date().toISOString(),
    status: "queued",
    attempts: 0,
  };
  return upsertDoraQueueItem(item);
}

export async function getExistingDoraQueueForCandidate(args: {
  intakeId: string;
  candidateId: string;
  displayName: string;
}): Promise<DoraValidationQueueItem | null> {
  const queue = await listDoraQueue();
  return queue.find((row) => sameScope(row, args)) ?? null;
}

export async function getDoraQueueById(queueItemId: string): Promise<DoraValidationQueueItem | null> {
  return getDoraQueueItemById(queueItemId);
}
