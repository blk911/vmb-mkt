import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type { HashtagPasteSnapshot } from "./types";

const SNAPSHOT_PATH = path.join(getRuntimeDataRoot(), "hashtag-paste-intake-snapshots.generated.json");

async function ensureSnapshotStore(): Promise<void> {
  // Snapshots are operator breadcrumbs, so we initialize the JSON store eagerly.
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  try {
    await fs.access(SNAPSHOT_PATH);
  } catch {
    await writeJsonAtomic(SNAPSHOT_PATH, []);
  }
}

export async function readHashtagPasteSnapshots(): Promise<HashtagPasteSnapshot[]> {
  await ensureSnapshotStore();
  const rows = await readJsonArrayFile<HashtagPasteSnapshot>(SNAPSHOT_PATH, []);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendHashtagPasteSnapshot(snapshot: HashtagPasteSnapshot): Promise<HashtagPasteSnapshot> {
  const rows = await readHashtagPasteSnapshots();
  const next = [snapshot, ...rows.filter((row) => row.id !== snapshot.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(SNAPSHOT_PATH, next);
  return snapshot;
}
