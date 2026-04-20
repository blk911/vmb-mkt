import { normalizedTextFingerprint } from "./normalization";
import type { BuildSourceType, OutreachQueueItem } from "./types";

const RECENT_BUILD_WINDOW_MS = 30 * 60 * 1000;

export function buildSubmissionFingerprint(sourceType: BuildSourceType, rawText: string): string {
  return normalizedTextFingerprint([sourceType, rawText]);
}

export function buildFingerprintNote(fingerprint: string): string {
  return `pipeline_fingerprint:${fingerprint}`;
}

export function parseBuildFingerprintNote(note?: string): string | undefined {
  const text = (note || "").trim();
  if (!text.startsWith("pipeline_fingerprint:")) return undefined;
  return text.slice("pipeline_fingerprint:".length) || undefined;
}

export function isRecentIsoWithinWindow(iso: string | undefined, windowMs = RECENT_BUILD_WINDOW_MS): boolean {
  if (!iso) return false;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed <= windowMs;
}

export function outreachDedupeKey(item: Pick<OutreachQueueItem, "operatorId">): string {
  // `operatorId` is the canonical outreach identity. Re-adding the same operator should be idempotent.
  return item.operatorId.trim();
}
