import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type { ExternalSiteCaptureSnapshot } from "./types";

const SNAPSHOT_PATH = path.join(getRuntimeDataRoot(), "external-site-capture-snapshots.generated.json");

async function ensureSnapshotStore(): Promise<void> {
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  try {
    await fs.access(SNAPSHOT_PATH);
  } catch {
    await writeJsonAtomic(SNAPSHOT_PATH, []);
  }
}

export async function readExternalSiteCaptureSnapshots(): Promise<ExternalSiteCaptureSnapshot[]> {
  await ensureSnapshotStore();
  const rows = await readJsonArrayFile<ExternalSiteCaptureSnapshot>(SNAPSHOT_PATH, []);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendExternalSiteCaptureSnapshot(
  snapshot: ExternalSiteCaptureSnapshot
): Promise<ExternalSiteCaptureSnapshot> {
  const rows = await readExternalSiteCaptureSnapshots();
  const next = [snapshot, ...rows.filter((row) => row.id !== snapshot.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(SNAPSHOT_PATH, next);
  return snapshot;
}
