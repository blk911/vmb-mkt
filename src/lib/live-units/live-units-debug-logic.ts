/**
 * Client-safe helpers for Live Units load diagnostics (no server imports).
 */
import type { LiveUnitsLoadTrace } from "./live-units-debug-types";

export function basenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filePath;
}

export function formatAttemptsSummary(trace: LiveUnitsLoadTrace): string {
  return trace.attempts
    .map((a) => `${a.source}:${a.fileExists ? `${a.rawRowsInFile}` : "missing"}`)
    .join(" → ");
}

export function explainEmptyDataset(trace: LiveUnitsLoadTrace): string | null {
  if (trace.rowsSentToClient > 0) return null;
  if (trace.parseError) {
    return `Parse error on artifact: ${trace.parseError}`;
  }
  const anyFile = trace.attempts.some((a) => a.fileExists);
  if (!anyFile) {
    return "No Live Units JSON artifacts found under data/markets/ (expected beauty_live_units*.v1.json).";
  }
  const allZero = trace.attempts.filter((a) => a.fileExists).every((a) => a.rawRowsInFile === 0);
  if (allZero && trace.attempts.some((a) => a.fileExists)) {
    return "Fallback / candidate artifacts loaded but every file had 0 rows (empty or wrong schema).";
  }
  if (trace.droppedMalformed > 0 && trace.rowsAfterRequiredFieldGates === 0) {
    return `All ${trace.rowsLoadedRaw} raw rows failed required-field validation (live_unit_id, name_display, signal_mix, entity_score).`;
  }
  return "No usable live units after load and validation gates.";
}
