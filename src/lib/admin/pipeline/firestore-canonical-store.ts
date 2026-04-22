import "server-only";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import type { OutreachQueueItem } from "./types";
import type {
  DoraValidationQueueItem,
  DoraValidationResult,
  SocialDiscoveryQueueItem,
  SocialDiscoveryResult,
} from "@/lib/source-intake/phase2-types";
import type { ParsedCandidateRow, SourceIntakeRecord } from "@/lib/source-intake/types";

const COLLECTIONS = {
  intakes: "adminPipelineSourceIntakes",
  candidates: "adminPipelineParsedCandidates",
  doraQueue: "adminPipelineDoraQueue",
  doraResults: "adminPipelineDoraResults",
  socialQueue: "adminPipelineSocialQueue",
  socialResults: "adminPipelineSocialResults",
  outreachQueue: "adminPipelineOutreachQueue",
} as const;

function compareDescByIso(a?: string, b?: string): number {
  return (b || "").localeCompare(a || "");
}

function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeFirestoreValue(entry))
      .filter((entry) => entry !== undefined) as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, sanitizeFirestoreValue(entry)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

async function listCollection<T>(collectionName: string): Promise<T[]> {
  const snap = await adminDb().collection(collectionName).get();
  return snap.docs.map((doc) => doc.data() as T);
}

async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snap = await adminDb().collection(collectionName).doc(id).get();
  return snap.exists ? (snap.data() as T) : null;
}

async function setDocument<T>(collectionName: string, id: string, value: T): Promise<T> {
  await adminDb().collection(collectionName).doc(id).set(sanitizeFirestoreValue(value) as object);
  return value;
}

async function deleteDocument(collectionName: string, id: string): Promise<void> {
  await adminDb().collection(collectionName).doc(id).delete();
}

async function replaceCollection<T extends { id: string }>(collectionName: string, rows: T[]): Promise<T[]> {
  const db = adminDb();
  const snap = await db.collection(collectionName).get();
  const wantedIds = new Set(rows.map((row) => row.id));
  const batch = db.batch();

  for (const doc of snap.docs) {
    if (!wantedIds.has(doc.id)) {
      batch.delete(doc.ref);
    }
  }
  for (const row of rows) {
    batch.set(db.collection(collectionName).doc(row.id), sanitizeFirestoreValue(row) as object);
  }

  await batch.commit();
  return rows;
}

export async function firestoreListSourceIntakes(): Promise<SourceIntakeRecord[]> {
  const rows = await listCollection<SourceIntakeRecord>(COLLECTIONS.intakes);
  return rows.sort((a, b) => compareDescByIso(a.submittedAt, b.submittedAt));
}

export function firestoreGetSourceIntakeById(id: string): Promise<SourceIntakeRecord | null> {
  return getDocument<SourceIntakeRecord>(COLLECTIONS.intakes, id);
}

export function firestoreSetSourceIntake(record: SourceIntakeRecord): Promise<SourceIntakeRecord> {
  return setDocument(COLLECTIONS.intakes, record.id, record);
}

export async function firestoreListParsedCandidates(intakeId: string): Promise<ParsedCandidateRow[]> {
  const snap = await adminDb().collection(COLLECTIONS.candidates).where("intakeId", "==", intakeId).get();
  return snap.docs.map((doc) => doc.data() as ParsedCandidateRow).sort((a, b) => a.ordinal - b.ordinal);
}

export async function firestoreSaveParsedCandidates(
  intakeId: string,
  rows: ParsedCandidateRow[]
): Promise<ParsedCandidateRow[]> {
  const db = adminDb();
  const existing = await db.collection(COLLECTIONS.candidates).where("intakeId", "==", intakeId).get();
  const batch = db.batch();
  for (const doc of existing.docs) {
    batch.delete(doc.ref);
  }
  for (const row of rows) {
    batch.set(db.collection(COLLECTIONS.candidates).doc(row.id), sanitizeFirestoreValue(row) as object);
  }
  await batch.commit();
  return rows;
}

export async function firestoreListDoraQueue(): Promise<DoraValidationQueueItem[]> {
  const rows = await listCollection<DoraValidationQueueItem>(COLLECTIONS.doraQueue);
  return rows.sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export function firestoreSetDoraQueueItem(item: DoraValidationQueueItem): Promise<DoraValidationQueueItem> {
  return setDocument(COLLECTIONS.doraQueue, item.id, item);
}

export function firestoreGetDoraQueueItemById(id: string): Promise<DoraValidationQueueItem | null> {
  return getDocument<DoraValidationQueueItem>(COLLECTIONS.doraQueue, id);
}

export async function firestoreSaveDoraQueue(items: DoraValidationQueueItem[]): Promise<DoraValidationQueueItem[]> {
  const dedup = [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
    compareDescByIso(a.createdAt, b.createdAt)
  );
  return replaceCollection(COLLECTIONS.doraQueue, dedup);
}

export async function firestoreListDoraResults(): Promise<DoraValidationResult[]> {
  const rows = await listCollection<DoraValidationResult>(COLLECTIONS.doraResults);
  return rows.sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
}

export async function firestoreSaveDoraResult(result: DoraValidationResult): Promise<DoraValidationResult> {
  const existing = await adminDb().collection(COLLECTIONS.doraResults).where("queueItemId", "==", result.queueItemId).get();
  const batch = adminDb().batch();
  for (const doc of existing.docs) {
    if (doc.id !== result.id) {
      batch.delete(doc.ref);
    }
  }
  batch.set(
    adminDb().collection(COLLECTIONS.doraResults).doc(result.id),
    sanitizeFirestoreValue(result) as object
  );
  await batch.commit();
  return result;
}

export async function firestoreFindDoraResultByQueueItemId(queueItemId: string): Promise<DoraValidationResult | null> {
  const snap = await adminDb().collection(COLLECTIONS.doraResults).where("queueItemId", "==", queueItemId).limit(1).get();
  return snap.docs[0]?.data() as DoraValidationResult | undefined || null;
}

export async function firestoreListSocialQueue(): Promise<SocialDiscoveryQueueItem[]> {
  const rows = await listCollection<SocialDiscoveryQueueItem>(COLLECTIONS.socialQueue);
  return rows.sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export function firestoreSetSocialQueueItem(item: SocialDiscoveryQueueItem): Promise<SocialDiscoveryQueueItem> {
  return setDocument(COLLECTIONS.socialQueue, item.id, item);
}

export function firestoreGetSocialQueueItemById(id: string): Promise<SocialDiscoveryQueueItem | null> {
  return getDocument<SocialDiscoveryQueueItem>(COLLECTIONS.socialQueue, id);
}

export async function firestoreSaveSocialQueue(
  items: SocialDiscoveryQueueItem[]
): Promise<SocialDiscoveryQueueItem[]> {
  const dedup = [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
    compareDescByIso(a.createdAt, b.createdAt)
  );
  return replaceCollection(COLLECTIONS.socialQueue, dedup);
}

export async function firestoreListSocialResults(): Promise<SocialDiscoveryResult[]> {
  const rows = await listCollection<SocialDiscoveryResult>(COLLECTIONS.socialResults);
  return rows.sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
}

export async function firestoreSaveSocialResult(result: SocialDiscoveryResult): Promise<SocialDiscoveryResult> {
  const existing = await adminDb().collection(COLLECTIONS.socialResults).where("queueItemId", "==", result.queueItemId).get();
  const batch = adminDb().batch();
  for (const doc of existing.docs) {
    if (doc.id !== result.id) {
      batch.delete(doc.ref);
    }
  }
  batch.set(
    adminDb().collection(COLLECTIONS.socialResults).doc(result.id),
    sanitizeFirestoreValue(result) as object
  );
  await batch.commit();
  return result;
}

export async function firestoreFindSocialResultByQueueItemId(
  queueItemId: string
): Promise<SocialDiscoveryResult | null> {
  const snap = await adminDb().collection(COLLECTIONS.socialResults).where("queueItemId", "==", queueItemId).limit(1).get();
  return snap.docs[0]?.data() as SocialDiscoveryResult | undefined || null;
}

export async function firestoreListOutreachQueue(): Promise<OutreachQueueItem[]> {
  const rows = await listCollection<OutreachQueueItem>(COLLECTIONS.outreachQueue);
  return rows.sort((a, b) => compareDescByIso(a.addedAt, b.addedAt));
}

export async function firestoreSaveOutreachQueue(rows: OutreachQueueItem[]): Promise<OutreachQueueItem[]> {
  const deduped = [...new Map(rows.map((row) => [row.operatorId, row])).values()].sort((a, b) =>
    compareDescByIso(a.addedAt, b.addedAt)
  );
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.outreachQueue).get();
  const wantedIds = new Set(deduped.map((row) => row.operatorId));
  const batch = db.batch();
  for (const doc of snap.docs) {
    if (!wantedIds.has(doc.id)) batch.delete(doc.ref);
  }
  for (const row of deduped) {
    batch.set(
      db.collection(COLLECTIONS.outreachQueue).doc(row.operatorId),
      sanitizeFirestoreValue(row) as object
    );
  }
  await batch.commit();
  return deduped;
}

export function firestoreDeleteOutreachQueueItem(operatorId: string): Promise<void> {
  return deleteDocument(COLLECTIONS.outreachQueue, operatorId);
}
