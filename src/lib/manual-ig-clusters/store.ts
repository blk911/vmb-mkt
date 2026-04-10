import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import { buildClusterId, normalizeIgHandle, parseManualIgClusterText } from "./parser";
import { manualIgAcceptedStorePath, manualIgClusterFilePath, manualIgClustersDirPath } from "./runtime-paths";
import type { ManualIgAcceptedRecord, ManualIgCluster, ManualIgClusterItemStatus } from "./types";

function compareDescByIso(a?: string, b?: string): number {
  return (b || "").localeCompare(a || "");
}

function acceptedRecordId(clusterId: string, handle: string): string {
  return `migacc_${crypto.createHash("md5").update(`${clusterId}|${handle}`).digest("hex").slice(0, 12)}`;
}

function recomputeCounts(cluster: ManualIgCluster): ManualIgCluster {
  const acceptedCount = cluster.items.filter((item) => item.status === "accepted").length;
  const rejectedCount = cluster.items.filter((item) => item.status === "rejected").length;
  const unreviewedCount = cluster.items.filter((item) => item.status === "unreviewed").length;
  return {
    ...cluster,
    itemCount: cluster.items.length,
    acceptedCount,
    rejectedCount,
    unreviewedCount,
  };
}

async function ensureClusterDir(): Promise<void> {
  await fs.mkdir(manualIgClustersDirPath(), { recursive: true });
}

async function ensureAcceptedStore(): Promise<void> {
  const filePath = manualIgAcceptedStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonAtomic(filePath, []);
  }
}

async function readClusterFile(filePath: string): Promise<ManualIgCluster | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as ManualIgCluster;
  } catch {
    return null;
  }
}

async function writeCluster(cluster: ManualIgCluster): Promise<ManualIgCluster> {
  const next = recomputeCounts(cluster);
  await ensureClusterDir();
  await writeJsonAtomic(manualIgClusterFilePath(next.clusterId), next);
  return next;
}

export async function listManualIgClusters(): Promise<ManualIgCluster[]> {
  await ensureClusterDir();
  const names = await fs.readdir(manualIgClustersDirPath()).catch(() => []);
  const clusters: ManualIgCluster[] = [];
  for (const name of names) {
    if (!name.startsWith("cluster_") || !name.endsWith(".json")) continue;
    const cluster = await readClusterFile(path.join(manualIgClustersDirPath(), name));
    if (cluster) clusters.push(recomputeCounts(cluster));
  }
  return clusters.sort((a, b) => compareDescByIso(a.createdAt, b.createdAt));
}

export async function getManualIgClusterById(clusterId: string): Promise<ManualIgCluster | null> {
  await ensureClusterDir();
  const cluster = await readClusterFile(manualIgClusterFilePath(clusterId));
  return cluster ? recomputeCounts(cluster) : null;
}

export async function createManualIgCluster(input: {
  originHandle: string;
  pastedText: string;
  market?: string;
  tags?: string[];
}): Promise<ManualIgCluster> {
  const normalizedOriginHandle = normalizeIgHandle(input.originHandle);
  if (!normalizedOriginHandle) throw new Error("originHandle_required");
  if (!input.pastedText.trim()) throw new Error("pastedText_required");
  const clusterId = buildClusterId(normalizedOriginHandle);
  const createdAt = new Date().toISOString();
  const items = parseManualIgClusterText(input.pastedText);
  if (!items.length) throw new Error("no_cluster_items_parsed");
  const cluster: ManualIgCluster = {
    clusterId,
    createdAt,
    updatedAt: createdAt,
    sourceMeta: {
      originHandle: normalizedOriginHandle,
      captureMethod: "copy_paste",
      capturedAt: createdAt,
      clusterId,
      market: input.market?.trim() || undefined,
      tags: input.tags?.filter(Boolean) || undefined,
    },
    itemCount: items.length,
    acceptedCount: 0,
    rejectedCount: 0,
    unreviewedCount: items.length,
    items,
  };
  return writeCluster(cluster);
}

export async function listManualIgAcceptedRecords(): Promise<ManualIgAcceptedRecord[]> {
  await ensureAcceptedStore();
  const rows = await readJsonArrayFile<ManualIgAcceptedRecord>(manualIgAcceptedStorePath(), []);
  return rows.sort((a, b) => compareDescByIso(a.acceptedAt, b.acceptedAt));
}

// Accepted records live separately from raw cluster files so hand-curated review
// decisions can be promoted downstream later without mutating or erasing the raw
// copied adjacency map that produced them.
export async function appendManualIgAcceptedRecord(record: Omit<ManualIgAcceptedRecord, "id">): Promise<{
  acceptedRecord: ManualIgAcceptedRecord;
  inserted: boolean;
}> {
  const existing = await listManualIgAcceptedRecords();
  const normalizedHandle = normalizeIgHandle(record.handle);
  const prior = existing.find((row) => normalizeIgHandle(row.handle) === normalizedHandle);
  if (prior) return { acceptedRecord: prior, inserted: false };
  const acceptedRecord: ManualIgAcceptedRecord = {
    ...record,
    id: acceptedRecordId(record.clusterId, normalizedHandle),
    handle: normalizedHandle,
  };
  const next = [acceptedRecord, ...existing].sort((a, b) => compareDescByIso(a.acceptedAt, b.acceptedAt));
  await writeJsonAtomic(manualIgAcceptedStorePath(), next);
  return { acceptedRecord, inserted: true };
}

export async function updateManualIgClusterItemStatus(args: {
  clusterId: string;
  itemId: string;
  status: ManualIgClusterItemStatus;
}): Promise<ManualIgCluster> {
  const cluster = await getManualIgClusterById(args.clusterId);
  if (!cluster) throw new Error("cluster_not_found");
  const index = cluster.items.findIndex((item) => item.id === args.itemId);
  if (index === -1) throw new Error("cluster_item_not_found");
  const now = new Date().toISOString();
  const item = cluster.items[index];
  const nextItem =
    args.status === "accepted"
      ? {
          ...item,
          status: "accepted" as const,
          acceptedAt: item.acceptedAt || now,
          rejectedAt: undefined,
        }
      : args.status === "rejected"
        ? {
            ...item,
            status: "rejected" as const,
            rejectedAt: item.rejectedAt || now,
            acceptedAt: undefined,
          }
        : item;
  const nextCluster: ManualIgCluster = {
    ...cluster,
    updatedAt: now,
    items: cluster.items.map((row, rowIndex) => (rowIndex === index ? nextItem : row)),
  };
  return writeCluster(nextCluster);
}
