/**
 * Loads Live Units data for server render:
 * 1) Optional HTTP JSON (`LIVE_UNITS_JSON_URL`)
 * 2) Optional Firestore document (`LIVE_UNITS_FIRESTORE_*`)
 * 3) Local JSON artifact cascade (shop_context → tuned → base), unless disabled
 *
 * `LIVE_UNITS_FORCE_ARTIFACT_FIRST=1` — try files before remote (local dev).
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  LiveUnitsArtifactSource,
  LiveUnitsLoadAttempt,
  LiveUnitsLoadTrace,
  LiveUnitsRemoteAttempt,
  LiveUnitsSourceMode,
} from "./live-units-debug-types";
import { gateLiveUnitRows } from "./live-units-parse";
import { loadRowsFromFirestoreDocument, loadRowsFromHttpJsonUrl } from "./live-units-remote";

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

/**
 * File-only cascade — same semantics as legacy loader (prefers first non-empty file).
 */
export function loadLiveUnitsFromArtifactsSync(): {
  rawRows: unknown[];
  attempts: LiveUnitsLoadAttempt[];
  artifactTier: LiveUnitsArtifactSource | null;
  chosenPath: string | null;
  parseError?: string;
} {
  const attempts: LiveUnitsLoadAttempt[] = [];
  let artifactTier: LiveUnitsArtifactSource | null = null;
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
      artifactTier = source;
      chosenPath = filePath;
      rawRows = parsed.rows;
      break;
    }
  }

  if (artifactTier === null) {
    for (const { source, basename } of [...ARTIFACT_ORDER].reverse()) {
      const filePath = artifactPath(basename);
      if (!existsSync(filePath)) continue;
      const parsed = parseRowsFromFile(filePath);
      artifactTier = source;
      chosenPath = filePath;
      rawRows = parsed.rows;
      if (parsed.parseError) parseError = parsed.parseError;
      break;
    }
  }

  if (artifactTier === null) {
    artifactTier = "base";
    chosenPath = artifactPath(ARTIFACT_ORDER[ARTIFACT_ORDER.length - 1]!.basename);
  }

  return { rawRows, attempts, artifactTier, chosenPath, parseError };
}

export type LoadedLiveUnitsPayload = {
  rows: unknown[];
  trace: LiveUnitsLoadTrace;
};

function buildTrace(input: {
  cwd: string;
  sourceMode: LiveUnitsSourceMode;
  artifactTier: LiveUnitsArtifactSource | null;
  remoteAttempts: LiveUnitsRemoteAttempt[];
  attempts: LiveUnitsLoadAttempt[];
  chosenPath: string | null;
  rawRows: unknown[];
  parseError?: string;
  gatedRows: unknown[];
  droppedMalformed: number;
}): LiveUnitsLoadTrace {
  const rowsLoadedRaw = input.rawRows.length;
  const rowsAfterParse = input.rawRows.length;
  const rowsAfterRequiredFieldGates = input.gatedRows.length;
  return {
    cwd: input.cwd,
    sourceMode: input.sourceMode,
    artifactTier: input.artifactTier,
    remoteAttempts: input.remoteAttempts,
    attempts: input.attempts,
    chosenPath: input.chosenPath,
    rowsLoadedRaw,
    rowsAfterParse,
    rowsAfterRequiredFieldGates,
    rowsSentToClient: rowsAfterRequiredFieldGates,
    droppedMalformed: input.droppedMalformed,
    parseError: input.parseError,
  };
}

function parseFirestorePath(combined: string): { collectionId: string; documentId: string } | null {
  const s = combined.trim();
  const idx = s.indexOf("/");
  if (idx <= 0 || idx === s.length - 1) return null;
  return { collectionId: s.slice(0, idx), documentId: s.slice(idx + 1) };
}

/**
 * CHECKPOINT 1–4: remote or file → parsed array → required-field gate → (caller maps to client shape).
 */
export async function loadLiveUnitsWithTrace(): Promise<LoadedLiveUnitsPayload> {
  const cwd = process.cwd();
  const remoteAttempts: LiveUnitsRemoteAttempt[] = [];
  const disableArtifact = process.env.LIVE_UNITS_DISABLE_ARTIFACT === "1";
  const forceArtifactFirst = process.env.LIVE_UNITS_FORCE_ARTIFACT_FIRST === "1";

  const finalize = (
    rawRows: unknown[],
    opts: {
      sourceMode: LiveUnitsSourceMode;
      artifactTier: LiveUnitsArtifactSource | null;
      attempts: LiveUnitsLoadAttempt[];
      chosenPath: string | null;
      parseError?: string;
    }
  ): LoadedLiveUnitsPayload => {
    const { gated, droppedMalformed } = gateLiveUnitRows(rawRows);
    const trace = buildTrace({
      cwd,
      sourceMode: opts.sourceMode,
      artifactTier: opts.artifactTier,
      remoteAttempts,
      attempts: opts.attempts,
      chosenPath: opts.chosenPath,
      rawRows,
      parseError: opts.parseError,
      gatedRows: gated,
      droppedMalformed,
    });
    return { rows: gated, trace };
  };

  const emptyArtifactAttempts = (): LiveUnitsLoadAttempt[] => {
    return ARTIFACT_ORDER.map(({ source, basename }) => {
      const p = artifactPath(basename);
      return {
        source,
        path: p,
        fileExists: existsSync(p),
        rawRowsInFile: existsSync(p) ? parseRowsFromFile(p).rows.length : 0,
      };
    });
  };

  if (forceArtifactFirst && !disableArtifact) {
    const local = loadLiveUnitsFromArtifactsSync();
    if (local.rawRows.length > 0) {
      return finalize(local.rawRows, {
        sourceMode: "artifact_fallback",
        artifactTier: local.artifactTier,
        attempts: local.attempts,
        chosenPath: local.chosenPath,
        parseError: local.parseError,
      });
    }
  }

  const httpUrl = process.env.LIVE_UNITS_JSON_URL?.trim();
  if (httpUrl) {
    const { rows, result } = await loadRowsFromHttpJsonUrl(httpUrl);
    remoteAttempts.push({
      kind: "http",
      label: result.sanitizedUrl,
      ok: result.ok,
      rowCount: result.rowCount,
      error: result.error,
      httpStatus: result.status,
    });
    if (result.ok && rows.length > 0) {
      return finalize(rows, {
        sourceMode: "api",
        artifactTier: null,
        attempts: emptyArtifactAttempts(),
        chosenPath: result.sanitizedUrl,
      });
    }
  }

  let collectionId = process.env.LIVE_UNITS_FIRESTORE_COLLECTION?.trim();
  let documentId = process.env.LIVE_UNITS_FIRESTORE_DOC_ID?.trim();
  const combinedPath = process.env.LIVE_UNITS_FIRESTORE_DOC_PATH?.trim();
  if ((!collectionId || !documentId) && combinedPath) {
    const parsed = parseFirestorePath(combinedPath);
    if (parsed) {
      collectionId = parsed.collectionId;
      documentId = parsed.documentId;
    }
  }

  if (collectionId && documentId && process.env.FIREBASE_PROJECT_ID) {
    const fs = await loadRowsFromFirestoreDocument(collectionId, documentId);
    remoteAttempts.push({
      kind: "firestore",
      label: fs.path,
      ok: fs.ok,
      rowCount: fs.rows.length,
      error: fs.error,
    });
    if (fs.ok && fs.rows.length > 0) {
      return finalize(fs.rows, {
        sourceMode: "datastore",
        artifactTier: null,
        attempts: emptyArtifactAttempts(),
        chosenPath: `${collectionId}/${documentId}`,
      });
    }
  }

  if (!disableArtifact) {
    const local = loadLiveUnitsFromArtifactsSync();
    const anyArtifactFile = local.attempts.some((a) => a.fileExists);
    const mode: LiveUnitsSourceMode = anyArtifactFile ? "artifact_fallback" : "none";
    return finalize(local.rawRows, {
      sourceMode: mode,
      artifactTier: local.artifactTier,
      attempts: local.attempts,
      chosenPath: local.chosenPath,
      parseError: local.parseError,
    });
  }

  return finalize([], {
    sourceMode: "none",
    artifactTier: null,
    attempts: emptyArtifactAttempts(),
    chosenPath: null,
  });
}
