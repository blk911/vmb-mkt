import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import type { DoraCrossReferenceRecord } from "./types";
export const DORA_HEADS = "adminPipelineDoraCrossReferences";
export const DORA_RUNS = "adminPipelineDoraCrossReferenceRuns";
const CONTROL = "adminPipelineDoraRefreshControl";
const digest = (id: string) => createHash("sha256").update(id).digest("hex");
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
/** A shared lease and short cooldown bound concurrent admin requests across serverless instances. */
export async function claimDoraRefresh(now = Date.now()): Promise<string | null> {
  const db = adminDb(), ref = db.collection(CONTROL).doc("official-dataset");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref), prior = snap.data();
    if (Date.parse(prior?.expiresAt || "") > now || Date.parse(prior?.nextAllowedAt || "") > now) return null;
    const token = randomUUID();
    tx.set(ref, { token, expiresAt: new Date(now + 90_000).toISOString(), nextAllowedAt: new Date(now + 15_000).toISOString() });
    return token;
  });
}
export async function releaseDoraRefresh(token: string): Promise<void> {
  const db = adminDb(), ref = db.collection(CONTROL).doc("official-dataset");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.token === token) tx.set(ref, { expiresAt: new Date().toISOString(), nextAllowedAt: new Date(Date.now() + 15_000).toISOString() });
  });
}
export async function readDoraCrossReference(catalogId: string): Promise<DoraCrossReferenceRecord | null> {
  const snap = await adminDb().collection(DORA_HEADS).doc(digest(catalogId)).get();
  const record = snap.data()?.record as DoraCrossReferenceRecord | undefined;
  return record?.schemaVersion === 1 && record.catalogId === catalogId ? record : null;
}
/** Immutable observations plus a compare-and-set head. Never writes source IDs, review decisions or lists. */
export async function saveDoraCrossReference(record: DoraCrossReferenceRecord, token: string): Promise<void> {
  const db = adminDb(), control = db.collection(CONTROL).doc("official-dataset");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(control), lease = snap.data();
    if (lease?.token !== token || !Number.isFinite(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= Date.now()) throw new Error("dora_refresh_lease_changed");
    tx.create(db.collection(DORA_RUNS).doc(record.runId), clean(record));
    tx.set(db.collection(DORA_HEADS).doc(digest(record.catalogId)), { record: clean(record) });
  });
}
