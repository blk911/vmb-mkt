import { getSocialQueueItemById, listSocialQueue, listSocialResults, upsertSocialQueueItem } from "./phase2-store";
import { createSourceIntakeId } from "./store";
import type { SocialDiscoveryQueueItem } from "./phase2-types";
import type { SourceType } from "./types";

function sameScope(
  row: SocialDiscoveryQueueItem,
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

export async function enqueueSocialDiscoveryForCandidate(args: {
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
}): Promise<SocialDiscoveryQueueItem> {
  const [queue, results] = await Promise.all([listSocialQueue(), listSocialResults()]);
  const existing = queue.find((row) => sameScope(row, args));
  if (existing) {
    const hasResolved = results.some((result) => result.queueItemId === existing.id);
    if (existing.status !== "dismissed" || hasResolved) return existing;
  }

  const item: SocialDiscoveryQueueItem = {
    id: createSourceIntakeId("sq"),
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
    createdAt: new Date().toISOString(),
    status: "queued",
    attempts: 0,
    lastAttemptAt: undefined,
  };
  return upsertSocialQueueItem(item);
}

export async function getExistingSocialQueueForCandidate(args: {
  intakeId: string;
  candidateId: string;
  displayName: string;
}): Promise<SocialDiscoveryQueueItem | null> {
  const queue = await listSocialQueue();
  return queue.find((row) => sameScope(row, args)) ?? null;
}

export async function getSocialQueueById(queueItemId: string): Promise<SocialDiscoveryQueueItem | null> {
  return getSocialQueueItemById(queueItemId);
}
