/**
 * Client-safe helpers for Live Units load diagnostics (no server imports).
 */
import type { LiveUnitsLoadTrace } from "./live-units-debug-types";

export function basenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filePath;
}

export function formatRemoteAttemptsSummary(trace: LiveUnitsLoadTrace): string {
  if (!trace.remoteAttempts.length) return "—";
  return trace.remoteAttempts
    .map((a) => {
      const n = typeof a.rowCount === "number" ? `${a.rowCount}` : "?";
      const err = a.error ? ` err=${a.error}` : "";
      const oc = a.outcome ? ` outcome=${a.outcome}` : "";
      const st = a.httpStatus != null ? ` http=${a.httpStatus}` : "";
      return `${a.kind}:${a.label} ok=${a.ok} rows=${n}${st}${oc}${err}`;
    })
    .join(" · ");
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
  if (trace.sourceMode === "api") {
    const http = trace.remoteAttempts.find((r) => r.kind === "http");
    if (http?.error) return `HTTP source failed: ${http.error}`;
    return "HTTP JSON URL returned no rows or unreachable — check LIVE_UNITS_JSON_URL and auth.";
  }
  if (trace.sourceMode === "datastore") {
    const fs = trace.remoteAttempts.find((r) => r.kind === "firestore");
    if (fs?.error) return `Firestore source failed: ${fs.error}`;
    return "Firestore document had no rows — check LIVE_UNITS_FIRESTORE_* env and document shape `{ rows: [...] }`.";
  }
  if (trace.sourceMode === "none") {
    const http = trace.remoteAttempts.find((r) => r.kind === "http");
    if (http?.outcome === "empty" || (http?.ok && (http.rowCount ?? 0) === 0)) {
      return "Remote JSON responded OK but `{ rows: [] }` or missing `rows`, and no artifact fallback produced rows. Set LIVE_UNITS_JSON_URL to a valid payload or use artifact files.";
    }
    if (http?.outcome === "timeout" || (http?.error && /timeout/i.test(http.error))) {
      return `Remote JSON timed out (${http.error ?? "timeout"}). Increase LIVE_UNITS_FETCH_TIMEOUT_MS or check URL availability.`;
    }
    if (http?.error) {
      return `Remote JSON failed: ${http.error}. No artifact fallback produced rows.`;
    }
    return "No remote Live Units source produced rows and no artifact fallback was available. Configure LIVE_UNITS_JSON_URL (or Firestore), or deploy data/markets/*.json, or unset LIVE_UNITS_DISABLE_ARTIFACT.";
  }
  const anyFile = trace.attempts.some((a) => a.fileExists);
  if (!anyFile) {
    return "No Live Units JSON artifacts under data/markets/ and no remote source produced rows. Configure LIVE_UNITS_JSON_URL or Firestore, or deploy with data files.";
  }
  const allZero = trace.attempts.filter((a) => a.fileExists).every((a) => a.rawRowsInFile === 0);
  if (allZero && trace.attempts.some((a) => a.fileExists)) {
    return "Artifact files exist but every file had 0 rows (empty or wrong schema).";
  }
  if (trace.droppedMalformed > 0 && trace.rowsAfterRequiredFieldGates === 0) {
    return `All ${trace.rowsLoadedRaw} raw rows failed required-field validation (live_unit_id, name_display, signal_mix, entity_score).`;
  }
  return "No usable live units after load and validation gates.";
}
