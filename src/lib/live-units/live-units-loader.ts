/**
 * Loads Live Units data for server render (single hydrated `rows` array for page + Queue Snapshot + all modes).
 *
 * Priority (unless `LIVE_UNITS_FORCE_ARTIFACT_FIRST=1`):
 * 1. Remote JSON — `LIVE_UNITS_JSON_URL` (+ optional `LIVE_UNITS_JSON_BEARER_TOKEN`, `LIVE_UNITS_JSON_AUTH_HEADER`, `LIVE_UNITS_FETCH_TIMEOUT_MS`)
 * 2. Firestore — `LIVE_UNITS_FIRESTORE_COLLECTION` + `LIVE_UNITS_FIRESTORE_DOC_ID`, or `LIVE_UNITS_FIRESTORE_DOC_PATH` as `collection/doc` (requires `FIREBASE_PROJECT_ID` / admin SDK)
 * 3. Artifact cascade — `data/markets/` → shop_context → tuned → base (unless `LIVE_UNITS_DISABLE_ARTIFACT=1`)
 *
 * `LIVE_UNITS_FORCE_ARTIFACT_FIRST=1` — try artifacts first; if empty, continue with remote + Firestore + artifacts again.
 *
 * Expected JSON shape (remote or file): `{ "rows": [ ... ] }`
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
import { normalizeZoneId } from "@/lib/geo/target-zones";
import { aggregateGateDropReasons, gateLiveUnitRows } from "./live-units-parse";
import { loadRowsFromFirestoreDocument, loadRowsFromHttpJsonUrl } from "./live-units-remote";
import { getZoneId, type WorkModeRow } from "./work-mode-logic";

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
  gateDropReasons?: Array<{ tag: string; count: number }>;
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
    gateDropReasons: input.gateDropReasons,
    parseError: input.parseError,
  };
}

function parseFirestorePath(combined: string): { collectionId: string; documentId: string } | null {
  const s = combined.trim();
  const idx = s.indexOf("/");
  if (idx <= 0 || idx === s.length - 1) return null;
  return { collectionId: s.slice(0, idx), documentId: s.slice(idx + 1) };
}

function rowCityLower(row: unknown): string {
  if (row === null || typeof row !== "object") return "";
  const c = (row as Record<string, unknown>).city;
  return typeof c === "string" ? c.toLowerCase() : "";
}

/**
 * Dev / opt-in: count gated rows whose `city` matches area substrings (Quebec corridor, Westminster, Lafayette).
 * Set LIVE_UNITS_GEO_DEBUG=0 to silence in development. Set LIVE_UNITS_GEO_DEBUG=1 to log in production.
 */
function logLiveUnitsGeoCityDebug(rows: unknown[], label: string): void {
  if (!isLiveUnitsGeoDebugEnabled()) return;

  const westminster = rows.filter((r) => rowCityLower(r).includes("westminster")).length;
  const lafayette = rows.filter((r) => rowCityLower(r).includes("lafayette")).length;
  const quebec = rows.filter((r) => rowCityLower(r).includes("quebec")).length;
  const southeastDenver = rows.filter((r) => {
    const c = rowCityLower(r);
    return c.includes("southeast") || c.includes("southeast denver");
  }).length;

  console.log(`[live-units geo] ${label} gated rows total: ${rows.length}`);
  console.log(`[live-units geo] city includes 'westminster': ${westminster}`);
  console.log(`[live-units geo] city includes 'lafayette': ${lafayette}`);
  console.log(`[live-units geo] city includes 'quebec': ${quebec}`);
  console.log(`[live-units geo] city includes 'southeast' / 'southeast denver': ${southeastDenver}`);
  console.log(
    `[live-units geo] hint: >0 → likely data in those city strings (if zones still empty, suspect mapping); 0 → likely ingest/coverage gap for city field`
  );
}

function isLiveUnitsGeoDebugEnabled(): boolean {
  return (
    process.env.LIVE_UNITS_GEO_DEBUG === "1" ||
    (process.env.NODE_ENV === "development" && process.env.LIVE_UNITS_GEO_DEBUG !== "0")
  );
}

/** Read-only: same zone resolution as Markets trace (`getZoneId` → `normalizeZoneId`). */
function liveUnitSamplePayload(row: unknown) {
  const o = row as Record<string, unknown>;
  const name =
    typeof o.name_display === "string"
      ? o.name_display
      : typeof o.name === "string"
        ? o.name
        : null;
  const city = typeof o.city === "string" ? o.city : null;
  let address: string | null = null;
  const rs = o.raw_snippets;
  if (rs && typeof rs === "object") {
    const g = (rs as Record<string, unknown>).google;
    if (g && typeof g === "object") {
      const a = (g as Record<string, unknown>).address;
      if (typeof a === "string") address = a;
    }
  }
  const zid = getZoneId(row as WorkModeRow);
  const normalized =
    zid === "NO_ZONE" ? null : normalizeZoneId(zid);
  return {
    name,
    city,
    address,
    zone_id: zid === "NO_ZONE" ? null : zid,
    normalized_zone_id: normalized,
  };
}

/**
 * When city geo counts &gt; 0 but zone trace is 0, log row samples (zone_id vs city) — assignment vs ingest.
 * Same enablement as `logLiveUnitsGeoCityDebug`.
 */
function logLiveUnitsGeoSampleDebug(gatedRows: unknown[], sourceMode: string): void {
  if (!isLiveUnitsGeoDebugEnabled()) return;

  const sampleCity = (label: string, match: (r: unknown) => boolean) => {
    const matched = gatedRows.filter(match);
    if (matched.length === 0) return;
    console.log(`[live-units geo sample] ${sourceMode} ${label} count=${matched.length}`);
    console.log(matched.slice(0, 10).map((r) => liveUnitSamplePayload(r)));
  };

  sampleCity("westminster", (r) => rowCityLower(r).includes("westminster"));
  sampleCity("lafayette", (r) => rowCityLower(r).includes("lafayette"));
  sampleCity("quebec", (r) => rowCityLower(r).includes("quebec"));
  sampleCity("southeast", (r) => {
    const c = rowCityLower(r);
    return c.includes("southeast") || c.includes("southeast denver");
  });
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
    const gateDropReasons =
      droppedMalformed > 0 ? aggregateGateDropReasons(rawRows) : undefined;
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
      gateDropReasons,
    });
    logLiveUnitsGeoCityDebug(gated, opts.sourceMode);
    logLiveUnitsGeoSampleDebug(gated, opts.sourceMode);
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
      outcome: result.outcome,
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
      outcome: !fs.ok ? "failed" : fs.rows.length > 0 ? "ok" : "empty",
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
