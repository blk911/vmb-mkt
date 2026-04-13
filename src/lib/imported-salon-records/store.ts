import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type { ImportedSalonRecord, ImportedSalonRecordStatus } from "./types";

const RECORDS_PATH = path.join(getRuntimeDataRoot(), "imported-salon-records.generated.json");

async function ensureImportedSalonRecordStore(): Promise<void> {
  await fs.mkdir(path.dirname(RECORDS_PATH), { recursive: true });
  try {
    await fs.access(RECORDS_PATH);
  } catch {
    await writeJsonAtomic(RECORDS_PATH, []);
  }
}

function hydrateImportedSalonRecord(record: ImportedSalonRecord): ImportedSalonRecord {
  return {
    ...record,
    decisionStatus: record.decisionStatus || "unresolved",
  };
}

export async function readImportedSalonRecords(): Promise<ImportedSalonRecord[]> {
  await ensureImportedSalonRecordStore();
  const rows = await readJsonArrayFile<ImportedSalonRecord>(RECORDS_PATH, []);
  return rows.map(hydrateImportedSalonRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getImportedSalonRecordById(recordId: string): Promise<ImportedSalonRecord | null> {
  const rows = await readImportedSalonRecords();
  return rows.find((row) => row.id === recordId) ?? null;
}

export async function getImportedSalonRecordBySourceDraftId(sourceDraftId: string): Promise<ImportedSalonRecord | null> {
  const rows = await readImportedSalonRecords();
  return rows.find((row) => row.sourceDraftId === sourceDraftId) ?? null;
}

export async function appendImportedSalonRecord(record: ImportedSalonRecord): Promise<ImportedSalonRecord> {
  const rows = await readImportedSalonRecords();
  const next = [hydrateImportedSalonRecord(record), ...rows.filter((row) => row.id !== record.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(RECORDS_PATH, next);
  return hydrateImportedSalonRecord(record);
}

export async function updateImportedSalonRecordStatus(
  recordId: string,
  status: ImportedSalonRecordStatus
): Promise<ImportedSalonRecord> {
  const rows = await readImportedSalonRecords();
  const index = rows.findIndex((row) => row.id === recordId);
  if (index === -1) throw new Error("record_not_found");
  const updated: ImportedSalonRecord = {
    ...rows[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;
  await writeJsonAtomic(RECORDS_PATH, rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return updated;
}

export async function updateImportedSalonRecordDecisionStatus(
  recordId: string,
  decisionStatus: ImportDecisionStatus
): Promise<ImportedSalonRecord> {
  const rows = await readImportedSalonRecords();
  const index = rows.findIndex((row) => row.id === recordId);
  if (index === -1) throw new Error("record_not_found");
  const updated: ImportedSalonRecord = {
    ...rows[index],
    decisionStatus,
    decisionUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;
  await writeJsonAtomic(RECORDS_PATH, rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return updated;
}
