import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import type { ParsedCandidateRow } from "@/lib/source-intake/types";
import type { ProfileLink, ProfileRefinementRecord } from "./profile-types";
import { PROFILE_FACT_RECOVERY_VERSION, reconcileCandidateProfile } from "./profile-model";
import { usesFirestoreCanonicalPipelineStore } from "./canonical-store-config";

const HEADS = "adminPipelineProfileRefinements";
const RUNS = "adminPipelineProfileRefinementRuns";
const LEASE_MS = 120_000;
type Lease = { token: string; fingerprint: string; expiresAt: string };
type Head = { record?: ProfileRefinementRecord; lease?: Lease };
export type ProfileClaim = { status: "claimed"; token: string; previous: ProfileRefinementRecord | null }
  | { status: "cached"; record: ProfileRefinementRecord } | { status: "busy" };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Bind observations to the source facts, not changing manual review outcomes. */
export function fingerprintCandidate(candidate: ParsedCandidateRow, evidenceLinks: readonly ProfileLink[] = []): string {
  // Review decisions are independent of evidence refresh. Every other stored
  // source field participates so new recovery aliases cannot reuse an old cache.
  const fields = Object.entries(candidate).filter(([key]) => !["reviewAction", "suggestedMatch"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right));
  return digest(JSON.stringify({ engine: PROFILE_FACT_RECOVERY_VERSION, fields, evidenceLinks: [...evidenceLinks].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) }));
}

function usesFirestore(): boolean { return usesFirestoreCanonicalPipelineStore(); }

function location(reviewKey: string) {
  const id = digest(reviewKey);
  const root = path.join(getRuntimeDataRoot(), "profile-refinements");
  return { id, root, head: path.join(root, `${id}.json`), lock: path.join(root, `${id}.lock`) };
}

async function fileHead(filename: string): Promise<Head> {
  try { return JSON.parse(await fs.readFile(filename, "utf8")) as Head; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("profile_store_unavailable");
  }
}

async function withFileLock<T>(reviewKey: string, work: (head: Head, save: (head: Head) => Promise<void>) => Promise<T>): Promise<T | null> {
  const loc = location(reviewKey);
  await fs.mkdir(loc.root, { recursive: true });
  let lock;
  try { lock = await fs.open(loc.lock, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("profile_store_unavailable");
    // Locks cover local filesystem operations only, never the external fetch.
    try { if (Date.now() - (await fs.stat(loc.lock)).mtimeMs > LEASE_MS) await fs.unlink(loc.lock); } catch { /* next request may retry */ }
    return null;
  }
  try {
    const save = async (head: Head) => {
      const temp = `${loc.head}.${randomUUID()}.tmp`;
      await fs.writeFile(temp, JSON.stringify(clean(head)), { flag: "wx" });
      await fs.rename(temp, loc.head);
    };
    return await work(await fileHead(loc.head), save);
  } finally { await lock.close(); await fs.unlink(loc.lock).catch(() => undefined); }
}

function matchingRecord(head: Head, reviewKey: string, fingerprint?: string): ProfileRefinementRecord | null {
  const row = head?.record;
  if (!row || row.schemaVersion !== 1 || row.reviewKey !== reviewKey || (fingerprint !== undefined && row.fingerprint !== fingerprint)
    || row.profile?.schemaVersion !== 1 || !Array.isArray(row.profile.bookingLinks)
    || !Array.isArray(row.profile.socialLinks) || !Array.isArray(row.profile.websiteLinks) || !Array.isArray(row.profile.observations)) return null;
  return clean(row);
}

export async function readProfileRefinement(reviewKey: string, fingerprint: string, candidate?: ParsedCandidateRow): Promise<ProfileRefinementRecord | null> {
  let head: Head;
  if (usesFirestore()) {
    const doc = await adminDb().collection(HEADS).doc(location(reviewKey).id).get();
    head = doc.exists ? doc.data() as Head : {};
  } else head = await fileHead(location(reviewKey).head);
  if (candidate && `${candidate.intakeId}::${candidate.id}` !== reviewKey) return null;
  const unambiguousCandidate = candidate && !candidate.intakeId.includes(":") && !candidate.id.includes(":");
  // A legacy delimiter key alone cannot authorize a cross-candidate stale merge.
  const record = matchingRecord(head, reviewKey, candidate ? undefined : fingerprint);
  if (record && candidate && !unambiguousCandidate && record.fingerprint !== fingerprint
    && record.profile.candidateRef !== JSON.stringify([candidate.intakeId, candidate.id])) return null;
  if (record) {
    const exact = record.fingerprint === fingerprint;
    if (candidate && (!record.profile.candidateRef || record.profile.candidateRef === reviewKey)) {
      record.profile.candidateRef = JSON.stringify([candidate.intakeId, candidate.id]);
    }
    record.profile = candidate
      ? exact ? reconcileCandidateProfile(record.profile, reconcileCandidateProfile(candidate)) : reconcileCandidateProfile(candidate, record.profile)
      : reconcileCandidateProfile(record.profile);
    if (!exact) {
      // A previous head is historical evidence, never a cache hit for changed facts.
      record.profile.nextAttemptAt = undefined;
      if (record.profile.lastAttemptAt) record.profile.freshness = "stale";
    }
  }
  if (record && Date.parse(record.profile.nextAttemptAt || "") <= Date.now()) record.profile.freshness = "stale";
  return record;
}

export async function claimProfileRefinement(reviewKey: string, fingerprint: string, now = Date.now()): Promise<ProfileClaim> {
  const decide = (head: Head): { claim: ProfileClaim; head?: Head } => {
    if (head.lease && Date.parse(head.lease.expiresAt) > now) return { claim: { status: "busy" } };
    const previous = matchingRecord(head, reviewKey);
    if (previous?.fingerprint === fingerprint && Date.parse(previous.profile.nextAttemptAt || "") > now) return { claim: { status: "cached", record: previous } };
    const token = randomUUID();
    return { claim: { status: "claimed", token, previous }, head: { ...head, lease: { token, fingerprint, expiresAt: new Date(now + LEASE_MS).toISOString() } } };
  };
  if (usesFirestore()) {
    const db = adminDb(), ref = db.collection(HEADS).doc(location(reviewKey).id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref), result = decide(snap.exists ? snap.data() as Head : {});
      if (result.head) tx.set(ref, clean(result.head));
      return result.claim;
    });
  }
  return await withFileLock(reviewKey, async (head, save) => {
    const result = decide(head); if (result.head) await save(result.head); return result.claim;
  }) ?? { status: "busy" };
}

/** Immutable run history plus a compare-and-set latest projection. No source/review writes. */
export async function completeProfileRefinement(record: ProfileRefinementRecord, token: string): Promise<boolean> {
  const valid = (head: Head) => head.lease?.token === token && head.lease.fingerprint === record.fingerprint
    && Date.parse(head.lease.expiresAt) > Date.now();
  const next = { record: clean(record) };
  if (usesFirestore()) {
    const db = adminDb(), headRef = db.collection(HEADS).doc(location(record.reviewKey).id);
    const runRef = db.collection(RUNS).doc(record.runId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(headRef), head = snap.exists ? snap.data() as Head : {};
      if (!valid(head)) return false;
      tx.create(runRef, clean(record)); tx.set(headRef, next); return true;
    });
  }
  return await withFileLock(record.reviewKey, async (head, save) => {
    if (!valid(head)) return false;
    const runDir = path.join(location(record.reviewKey).root, "runs", location(record.reviewKey).id);
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, `${record.runId}.json`), JSON.stringify(clean(record)), { flag: "wx" });
    await save(next); return true;
  }) ?? false;
}

export async function releaseProfileLease(reviewKey: string, token: string): Promise<void> {
  if (usesFirestore()) {
    const db = adminDb(), ref = db.collection(HEADS).doc(location(reviewKey).id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref), head = snap.exists ? snap.data() as Head : {};
      if (head.lease?.token !== token) return;
      const next = { ...head }; delete next.lease; tx.set(ref, clean(next));
    });
  } else await withFileLock(reviewKey, async (head, save) => {
    if (head.lease?.token !== token) return;
    const next = { ...head }; delete next.lease; await save(next);
  });
}
