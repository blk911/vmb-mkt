/**
 * Loads Live Units JSON artifacts with **empty-aware cascade**:
 * prefers shop_context → tuned → base, but **skips** a file that exists with 0 rows
 * so a stale/empty shop_context does not hide a full base artifact.
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LiveUnitsArtifactSource, LiveUnitsLoadTrace } from "./live-units-debug-types";

type LiveUnitsFileShape = {
  rows?: unknown;
};

const ARTIFACT_ORDER: Array<{ source: LiveUnitsArtifactSource; basename: string }> = [
  { source: "shop_context", basename: "beauty_live_units_shop_context.v1.json" },
  { source: "tuned", basename: "beauty_live_units_tuned.v1.json" },
  { source: "base", basename: "beauty_live_units.v1.json" },
];

function artifactPath(basename: string): string {
  return path.join(process.cwd(), "data", "markets", basename);
}

function parseRowsFromFile(filePath: string): { rows: unknown[]; parseError?: string } {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as LiveUnitsFileShape;
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    return { rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], parseError: msg };
  }
}

/** Minimal shape required for LiveUnitsClient / filters */
function passesRequiredFields(row: unknown): boolean {
  if (row === null || typeof row !== "object") return false;
  const o = row as Record<string, unknown>;
  const id = o.live_unit_id;
  if (typeof id !== "string" || !id.trim()) return false;
  if (typeof o.name_display !== "string") return false;
  if (typeof o.signal_mix !== "string") return false;
  if (typeof o.entity_score !== "number" || Number.isNaN(o.entity_score)) return false;
  return true;
}

export type LoadedLiveUnitsPayload = {
  rows: unknown[];
  source: LiveUnitsArtifactSource;
  trace: LiveUnitsLoadTrace;
};

/**
 * CHECKPOINT 1–4: raw file → parsed array → required-field gate → (caller maps to client shape).
 */
export function loadLiveUnitsWithTrace(): LoadedLiveUnitsPayload {
  const cwd = process.cwd();
  const attempts: LiveUnitsLoadTrace["attempts"] = [];
  let chosenSource: LiveUnitsArtifactSource | null = null;
  let chosenPath: string | null = null;
  let rawRows: unknown[] = [];
  let parseError: string | undefined;

  for (const { source, basename } of ARTIFACT_ORDER) {
    const filePath = artifactPath(basename);
    const fileExists = existsSync(filePath);
    if (!fileExists) {
      attempts.push({ source, path: filePath, fileExists: false, rawRowsInFile: 0 });
      continue;
    }
    const parsed = parseRowsFromFile(filePath);
    attempts.push({
      source,
      path: filePath,
      fileExists: true,
      rawRowsInFile: parsed.rows.length,
    });
    if (parsed.parseError) parseError = parsed.parseError;
    if (parsed.rows.length > 0) {
      chosenSource = source;
      chosenPath = filePath;
      rawRows = parsed.rows;
      break;
    }
  }

  /** Every file missing or every existing file had 0 rows — attach to last existing file for diagnostics */
  if (chosenSource === null) {
    for (const { source, basename } of [...ARTIFACT_ORDER].reverse()) {
      const filePath = artifactPath(basename);
      if (!existsSync(filePath)) continue;
      const parsed = parseRowsFromFile(filePath);
      chosenSource = source;
      chosenPath = filePath;
      rawRows = parsed.rows;
      if (parsed.parseError) parseError = parsed.parseError;
      break;
    }
  }

  if (chosenSource === null) {
    chosenSource = "base";
    chosenPath = artifactPath(ARTIFACT_ORDER[ARTIFACT_ORDER.length - 1]!.basename);
  }

  const rowsLoadedRaw = rawRows.length;
  const rowsAfterParse = rawRows.length;

  const gated: unknown[] = [];
  let droppedMalformed = 0;
  for (const row of rawRows) {
    if (passesRequiredFields(row)) gated.push(row);
    else droppedMalformed += 1;
  }

  const rowsAfterRequiredFieldGates = gated.length;

  const trace: LiveUnitsLoadTrace = {
    cwd,
    attempts,
    chosenSource,
    chosenPath,
    rowsLoadedRaw,
    rowsAfterParse,
    rowsAfterRequiredFieldGates,
    rowsSentToClient: rowsAfterRequiredFieldGates,
    droppedMalformed,
    parseError,
  };

  return {
    rows: gated,
    source: chosenSource,
    trace,
  };
}
