import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { outreachDedupeKey } from "./dedupe";
import type { OutreachQueueItem } from "./types";

const OUTREACH_QUEUE_PATH = path.join(getRuntimeDataRoot(), "outreach-queue.json");

async function ensureQueueFile() {
  await fs.mkdir(path.dirname(OUTREACH_QUEUE_PATH), { recursive: true });
  try {
    await fs.access(OUTREACH_QUEUE_PATH);
  } catch {
    await writeJsonAtomic(OUTREACH_QUEUE_PATH, []);
  }
}

export async function listOutreachQueue(): Promise<OutreachQueueItem[]> {
  await ensureQueueFile();
  const raw = await fs.readFile(OUTREACH_QUEUE_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed) ? (parsed as OutreachQueueItem[]) : [];
  return rows.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
}

export async function saveOutreachQueue(rows: OutreachQueueItem[]): Promise<OutreachQueueItem[]> {
  await ensureQueueFile();
  const deduped = new Map(rows.map((row) => [outreachDedupeKey(row), row]));
  const normalized = [...deduped.values()].sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  await writeJsonAtomic(OUTREACH_QUEUE_PATH, normalized);
  return normalized;
}

export async function addOutreachQueueItem(
  item: Omit<OutreachQueueItem, "addedAt"> & { addedAt?: string }
): Promise<{ item: OutreachQueueItem; outcome: "added" | "updated" | "already_exists" }> {
  const rows = await listOutreachQueue();
  const key = outreachDedupeKey(item);
  const existing = rows.find((row) => outreachDedupeKey(row) === key);
  const nextItem: OutreachQueueItem = {
    ...item,
    addedAt: existing?.addedAt || item.addedAt || new Date().toISOString(),
  };
  const sameAsExisting =
    existing &&
    existing.name === nextItem.name &&
    existing.ig === nextItem.ig &&
    existing.priority === nextItem.priority &&
    existing.city === nextItem.city &&
    existing.category === nextItem.category;

  if (sameAsExisting) {
    return { item: existing, outcome: "already_exists" };
  }

  await saveOutreachQueue([...rows.filter((row) => outreachDedupeKey(row) !== key), nextItem]);
  return { item: nextItem, outcome: existing ? "updated" : "added" };
}
