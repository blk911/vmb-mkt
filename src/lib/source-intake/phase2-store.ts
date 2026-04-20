import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type {
  DoraValidationQueueItem,
  DoraValidationResult,
  OperatorCandidateLinkSuggestion,
  SocialDiscoveryQueueItem,
  SocialDiscoveryResult,
  SourceIntakeDriftEvent,
} from "./phase2-types";

const RUNTIME_DIR = getRuntimeDataRoot();
const DORA_QUEUE_PATH = path.join(RUNTIME_DIR, "dora-validation-queue.generated.json");
const DORA_RESULTS_PATH = path.join(RUNTIME_DIR, "dora-validation-results.generated.json");
const SOCIAL_QUEUE_PATH = path.join(RUNTIME_DIR, "social-discovery-queue.generated.json");
const SOCIAL_RESULTS_PATH = path.join(RUNTIME_DIR, "social-discovery-results.generated.json");
const DRIFT_PATH = path.join(RUNTIME_DIR, "source-intake-drift.generated.json");
const OPERATOR_LINKS_PATH = path.join(RUNTIME_DIR, "operator-candidate-links.generated.json");

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

export async function listDoraQueue(): Promise<DoraValidationQueueItem[]> {
  const rows = await readArray<DoraValidationQueueItem>(DORA_QUEUE_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export async function saveDoraQueue(items: DoraValidationQueueItem[]): Promise<DoraValidationQueueItem[]> {
  const dedup = new Map(items.map((item) => [item.id, item]));
  const next = [...dedup.values()].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
  return writeArray(DORA_QUEUE_PATH, next);
}

export async function upsertDoraQueueItem(item: DoraValidationQueueItem): Promise<DoraValidationQueueItem> {
  const rows = await listDoraQueue();
  const next = [...rows.filter((row) => row.id !== item.id), item];
  await saveDoraQueue(next);
  return item;
}

export async function getDoraQueueItemById(id: string): Promise<DoraValidationQueueItem | null> {
  const rows = await listDoraQueue();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listDoraResults(): Promise<DoraValidationResult[]> {
  const rows = await readArray<DoraValidationResult>(DORA_RESULTS_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
}

export async function saveDoraResult(result: DoraValidationResult): Promise<DoraValidationResult> {
  const rows = await listDoraResults();
  const next = [...rows.filter((row) => row.id !== result.id && row.queueItemId !== result.queueItemId), result]
    .sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
  await writeArray(DORA_RESULTS_PATH, next);
  return result;
}

export async function findDoraResultByQueueItemId(queueItemId: string): Promise<DoraValidationResult | null> {
  const rows = await listDoraResults();
  return rows.find((row) => row.queueItemId === queueItemId) ?? null;
}

export async function listSocialQueue(): Promise<SocialDiscoveryQueueItem[]> {
  const rows = await readArray<SocialDiscoveryQueueItem>(SOCIAL_QUEUE_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export async function saveSocialQueue(items: SocialDiscoveryQueueItem[]): Promise<SocialDiscoveryQueueItem[]> {
  const dedup = new Map(items.map((item) => [item.id, item]));
  const next = [...dedup.values()].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
  return writeArray(SOCIAL_QUEUE_PATH, next);
}

export async function upsertSocialQueueItem(item: SocialDiscoveryQueueItem): Promise<SocialDiscoveryQueueItem> {
  const rows = await listSocialQueue();
  const next = [...rows.filter((row) => row.id !== item.id), item];
  await saveSocialQueue(next);
  return item;
}

export async function getSocialQueueItemById(id: string): Promise<SocialDiscoveryQueueItem | null> {
  const rows = await listSocialQueue();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listSocialResults(): Promise<SocialDiscoveryResult[]> {
  const rows = await readArray<SocialDiscoveryResult>(SOCIAL_RESULTS_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
}

export async function saveSocialResult(result: SocialDiscoveryResult): Promise<SocialDiscoveryResult> {
  const rows = await listSocialResults();
  const next = [...rows.filter((row) => row.id !== result.id && row.queueItemId !== result.queueItemId), result]
    .sort((a, b) => compareDescByIso(a.resolvedAt, b.resolvedAt));
  await writeArray(SOCIAL_RESULTS_PATH, next);
  return result;
}

export async function findSocialResultByQueueItemId(queueItemId: string): Promise<SocialDiscoveryResult | null> {
  const rows = await listSocialResults();
  return rows.find((row) => row.queueItemId === queueItemId) ?? null;
}

export async function listDriftEvents(): Promise<SourceIntakeDriftEvent[]> {
  const rows = await readArray<SourceIntakeDriftEvent>(DRIFT_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.detectedAt, b.detectedAt));
}

export async function saveDriftEvent(event: SourceIntakeDriftEvent): Promise<SourceIntakeDriftEvent> {
  const rows = await listDriftEvents();
  const next = [
    ...rows.filter(
      (row) =>
        row.id !== event.id &&
        !(row.baselineIntakeId === event.baselineIntakeId && row.comparisonIntakeId === event.comparisonIntakeId)
    ),
    event,
  ].sort((a, b) => compareDescByIso(a.detectedAt, b.detectedAt));
  await writeArray(DRIFT_PATH, next);
  return event;
}

export async function findDriftEventForPair(
  baselineIntakeId: string,
  comparisonIntakeId: string
): Promise<SourceIntakeDriftEvent | null> {
  const rows = await listDriftEvents();
  return rows.find(
    (row) => row.baselineIntakeId === baselineIntakeId && row.comparisonIntakeId === comparisonIntakeId
  ) ?? null;
}

export async function listOperatorCandidateLinks(): Promise<OperatorCandidateLinkSuggestion[]> {
  const rows = await readArray<OperatorCandidateLinkSuggestion>(OPERATOR_LINKS_PATH);
  return [...rows].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export async function saveOperatorCandidateLink(
  item: OperatorCandidateLinkSuggestion
): Promise<OperatorCandidateLinkSuggestion> {
  const rows = await listOperatorCandidateLinks();
  const next = [
    ...rows.filter(
      (row) =>
        row.id !== item.id &&
        !(row.candidateId === item.candidateId && row.targetType === item.targetType && row.targetId === item.targetId)
    ),
    item,
  ].sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
  await writeArray(OPERATOR_LINKS_PATH, next);
  return item;
}

export async function listDoraQueueByIntakeId(intakeId: string): Promise<DoraValidationQueueItem[]> {
  const rows = await listDoraQueue();
  return rows.filter((row) => row.intakeId === intakeId);
}

export async function listSocialQueueByIntakeId(intakeId: string): Promise<SocialDiscoveryQueueItem[]> {
  const rows = await listSocialQueue();
  return rows.filter((row) => row.intakeId === intakeId);
}

export async function listDriftEventsForIntakeId(intakeId: string): Promise<SourceIntakeDriftEvent[]> {
  const rows = await listDriftEvents();
  return rows.filter((row) => row.baselineIntakeId === intakeId || row.comparisonIntakeId === intakeId);
}

export async function listOperatorCandidateLinksByCandidateIds(
  candidateIds: string[]
): Promise<OperatorCandidateLinkSuggestion[]> {
  if (!candidateIds.length) return [];
  const wanted = new Set(candidateIds);
  const rows = await listOperatorCandidateLinks();
  return rows.filter((row) => wanted.has(row.candidateId));
}
