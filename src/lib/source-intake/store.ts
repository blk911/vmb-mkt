import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { usesFirestoreCanonicalPipelineStore } from "@/lib/admin/pipeline/canonical-store-config";
import {
  firestoreGetSourceIntakeById,
  firestoreListParsedCandidates,
  firestoreListSourceIntakes,
  firestoreSaveParsedCandidates,
  firestoreSetSourceIntake,
} from "@/lib/admin/pipeline/firestore-canonical-store";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type {
  IntakeProcessingReceipt,
  IntakeQueueItem,
  OperatorCandidateRecord,
  ParsedCandidateRow,
  SourceIntakeCreateInput,
  SourceIntakeRecord,
  StagedOperatorEvidence,
} from "./types";

const RUNTIME_DIR = getRuntimeDataRoot();
const INTAKES_PATH = path.join(RUNTIME_DIR, "source-intake.generated.json");
const CANDIDATES_PATH = path.join(RUNTIME_DIR, "source-intake-candidates.generated.json");
const PROCESSING_PATH = path.join(RUNTIME_DIR, "source-intake-processing.generated.json");
const OPERATOR_CANDIDATES_PATH = path.join(RUNTIME_DIR, "operator-candidates.generated.json");
const OPERATOR_EVIDENCE_PATH = path.join(RUNTIME_DIR, "operator-evidence.generated.json");
const DORA_QUEUE_PATH = path.join(RUNTIME_DIR, "dora-validation-queue.generated.json");
const SOCIAL_QUEUE_PATH = path.join(RUNTIME_DIR, "social-discovery-queue.generated.json");

function compareDescByIso(a?: string, b?: string): number {
  return (b || "").localeCompare(a || "");
}

async function ensureArrayFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    try {
      await fs.writeFile(filePath, "[]\n", { encoding: "utf8", flag: "wx" });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? (error as NodeJS.ErrnoException).code : "";
      if (code !== "EEXIST") throw error;
    }
  }
}

async function readArray<T>(filePath: string): Promise<T[]> {
  await ensureArrayFile(filePath);
  const rows = await readJsonArrayFile<T>(filePath, []);
  if (!Array.isArray(rows)) {
    throw new Error(`Invalid array store: ${path.basename(filePath)}`);
  }
  return rows;
}

async function writeArray<T>(filePath: string, rows: T[]): Promise<T[]> {
  await ensureArrayFile(filePath);
  await writeJsonAtomic(filePath, rows);
  return rows;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSourceIntakes(): Promise<SourceIntakeRecord[]> {
  if (usesFirestoreCanonicalPipelineStore()) {
    return firestoreListSourceIntakes();
  }
  const rows = await readArray<SourceIntakeRecord>(INTAKES_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.submittedAt, b.submittedAt));
}

export async function getSourceIntakeById(id: string): Promise<SourceIntakeRecord | null> {
  if (usesFirestoreCanonicalPipelineStore()) {
    return firestoreGetSourceIntakeById(id);
  }
  const rows = await listSourceIntakes();
  return rows.find((row) => row.id === id) ?? null;
}

export async function createSourceIntake(input: SourceIntakeCreateInput): Promise<SourceIntakeRecord> {
  const now = new Date().toISOString();
  const rows = await listSourceIntakes();
  const record: SourceIntakeRecord = {
    id: makeId("si"),
    sourceLabel: input.sourceLabel.trim(),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    facilityId: input.facilityId?.trim() || undefined,
    facilityName: input.facilityName?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    rawText: input.rawText,
    status: "pending",
    submittedAt: now,
  };
  if (usesFirestoreCanonicalPipelineStore()) {
    return firestoreSetSourceIntake(record);
  }
  const next = [record, ...rows].sort((a, b) => compareDescByIso(a.submittedAt, b.submittedAt));
  await writeArray(INTAKES_PATH, next);
  return record;
}

export async function updateSourceIntake(id: string, patch: Partial<SourceIntakeRecord>): Promise<SourceIntakeRecord> {
  if (usesFirestoreCanonicalPipelineStore()) {
    const current = await firestoreGetSourceIntakeById(id);
    if (!current) throw new Error("source_intake_not_found");
    const nextRow: SourceIntakeRecord = {
      ...current,
      ...patch,
      id: current.id,
      submittedAt: current.submittedAt,
    };
    return firestoreSetSourceIntake(nextRow);
  }
  const rows = await listSourceIntakes();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) throw new Error("source_intake_not_found");
  const current = rows[index];
  const nextRow: SourceIntakeRecord = {
    ...current,
    ...patch,
    id: current.id,
    submittedAt: current.submittedAt,
  };
  const next = rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row));
  await writeArray(INTAKES_PATH, next.sort((a, b) => compareDescByIso(a.submittedAt, b.submittedAt)));
  return nextRow;
}

export async function saveParsedCandidates(intakeId: string, rows: ParsedCandidateRow[]): Promise<ParsedCandidateRow[]> {
  const seen = new Set<string>();
  const normalized = [...rows]
    .map((row, index) => ({
      ...row,
      intakeId,
      ordinal: row.ordinal ?? index + 1,
      reviewAction: row.reviewAction ?? "pending",
    }))
    .sort((a, b) => a.ordinal - b.ordinal)
    .filter((row) => {
      if (!row.id) throw new Error("candidate_id_required");
      if (seen.has(row.id)) throw new Error(`duplicate_candidate_id:${row.id}`);
      seen.add(row.id);
      return true;
    });
  if (usesFirestoreCanonicalPipelineStore()) {
    await firestoreSaveParsedCandidates(intakeId, normalized);
    return normalized;
  }
  const existing = await readArray<ParsedCandidateRow>(CANDIDATES_PATH);
  const next = [...existing.filter((row) => row.intakeId !== intakeId), ...normalized];
  await writeArray(CANDIDATES_PATH, next);
  return normalized;
}

export async function listParsedCandidates(intakeId: string): Promise<ParsedCandidateRow[]> {
  if (usesFirestoreCanonicalPipelineStore()) {
    return firestoreListParsedCandidates(intakeId);
  }
  const rows = await readArray<ParsedCandidateRow>(CANDIDATES_PATH);
  return rows
    .filter((row) => row.intakeId === intakeId)
    .sort((a, b) => a.ordinal - b.ordinal);
}

export async function saveProcessingReceipt(receipt: IntakeProcessingReceipt): Promise<IntakeProcessingReceipt> {
  const rows = await readArray<IntakeProcessingReceipt>(PROCESSING_PATH);
  const next = [...rows.filter((row) => row.id !== receipt.id && row.intakeId !== receipt.intakeId), receipt]
    .sort((a, b) => compareDescByIso(a.processedAt, b.processedAt));
  await writeArray(PROCESSING_PATH, next);
  return receipt;
}

export async function listProcessingReceipts(intakeId?: string): Promise<IntakeProcessingReceipt[]> {
  const rows = await readArray<IntakeProcessingReceipt>(PROCESSING_PATH);
  return rows
    .filter((row) => !intakeId || row.intakeId === intakeId)
    .sort((a, b) => compareDescByIso(a.processedAt, b.processedAt));
}

export async function getProcessingReceiptByIntakeId(intakeId: string): Promise<IntakeProcessingReceipt | null> {
  const rows = await listProcessingReceipts(intakeId);
  return rows[0] ?? null;
}

export async function listOperatorCandidates(): Promise<OperatorCandidateRecord[]> {
  const rows = await readArray<OperatorCandidateRecord>(OPERATOR_CANDIDATES_PATH);
  return rows.sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export async function upsertOperatorCandidates(rows: OperatorCandidateRecord[]): Promise<OperatorCandidateRecord[]> {
  const existing = await listOperatorCandidates();
  const byId = new Map(existing.map((row) => [row.id, row]));
  for (const row of rows) byId.set(row.id, row);
  const next = [...byId.values()].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
  await writeArray(OPERATOR_CANDIDATES_PATH, next);
  return next;
}

export async function listStagedOperatorEvidence(): Promise<StagedOperatorEvidence[]> {
  return readArray<StagedOperatorEvidence>(OPERATOR_EVIDENCE_PATH);
}

export async function appendStagedOperatorEvidence(rows: StagedOperatorEvidence[]): Promise<StagedOperatorEvidence[]> {
  const existing = await listStagedOperatorEvidence();
  const byKey = new Map<string, StagedOperatorEvidence>();
  for (const row of existing) {
    byKey.set(`${row.intakeId}|${row.candidateId}|${row.factType}|${row.factValue}`, row);
  }
  for (const row of rows) {
    byKey.set(`${row.intakeId}|${row.candidateId}|${row.factType}|${row.factValue}`, row);
  }
  const next = [...byKey.values()].sort((a, b) => compareDescByIso(a.observedAt, b.observedAt));
  await writeArray(OPERATOR_EVIDENCE_PATH, next);
  return next;
}

async function appendQueueRows(filePath: string, rows: IntakeQueueItem[]): Promise<IntakeQueueItem[]> {
  const existing = await readArray<IntakeQueueItem>(filePath);
  const byKey = new Map<string, IntakeQueueItem>();
  for (const row of existing) {
    byKey.set(`${row.intakeId}|${row.candidateId}|${row.name}`, row);
  }
  for (const row of rows) {
    byKey.set(`${row.intakeId}|${row.candidateId}|${row.name}`, row);
  }
  const next = [...byKey.values()].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
  await writeArray(filePath, next);
  return next;
}

export async function appendDoraValidationQueue(rows: IntakeQueueItem[]): Promise<IntakeQueueItem[]> {
  return appendQueueRows(DORA_QUEUE_PATH, rows);
}

export async function appendSocialDiscoveryQueue(rows: IntakeQueueItem[]): Promise<IntakeQueueItem[]> {
  return appendQueueRows(SOCIAL_QUEUE_PATH, rows);
}

export function createSourceIntakeId(prefix: string): string {
  return makeId(prefix);
}
