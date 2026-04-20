import fs from "node:fs/promises";
import path from "node:path";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import type { AdminActionLogEntry } from "./types";

const LOG_PATH = path.join(getRuntimeDataRoot(), "admin-actions.log");

export async function appendAdminAction(entry: Omit<AdminActionLogEntry, "timestamp"> & { timestamp?: string }) {
  const payload: AdminActionLogEntry = {
    timestamp: entry.timestamp || new Date().toISOString(),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    result: entry.result,
    details: entry.details,
  };

  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  return payload;
}

export async function listAdminActions(limit = 50): Promise<AdminActionLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AdminActionLogEntry)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
