/**
 * Server-side load tracing for Live Units — diagnostics only.
 */

export type LiveUnitsArtifactSource = "shop_context" | "tuned" | "base";

/** How the primary dataset was resolved for this request. */
export type LiveUnitsSourceMode = "api" | "datastore" | "artifact_fallback" | "none";

export type LiveUnitsLoadAttempt = {
  source: LiveUnitsArtifactSource;
  /** Absolute or cwd-relative path attempted */
  path: string;
  fileExists: boolean;
  /** Length of `rows` array when file existed and parsed */
  rawRowsInFile: number;
};

/** Outcome for operator-facing trace (HTTP may be 200 OK but `rows` empty). */
export type LiveUnitsRemoteOutcome = "ok" | "empty" | "failed" | "timeout";

export type LiveUnitsRemoteAttempt = {
  kind: "http" | "firestore";
  /** Sanitized target (URL without query / collection path) */
  label: string;
  ok: boolean;
  rowCount?: number;
  error?: string;
  httpStatus?: number;
  /** Set for HTTP attempts — distinguishes 200+0 rows vs network/parse failure vs timeout. */
  outcome?: LiveUnitsRemoteOutcome;
};

export type LiveUnitsLoadTrace = {
  cwd: string;
  sourceMode: LiveUnitsSourceMode;
  /** When loading from JSON files — which tier supplied rows (or last tried). */
  artifactTier: LiveUnitsArtifactSource | null;
  remoteAttempts: LiveUnitsRemoteAttempt[];
  attempts: LiveUnitsLoadAttempt[];
  chosenPath: string | null;
  /** CHECKPOINT 1 */
  rowsLoadedRaw: number;
  /** CHECKPOINT 2 — same as raw if parse OK */
  rowsAfterParse: number;
  /** CHECKPOINT 3 — required fields present */
  rowsAfterRequiredFieldGates: number;
  /** CHECKPOINT 4 — after entity_id normalization, matches props.rows.length */
  rowsSentToClient: number;
  droppedMalformed: number;
  /** When `droppedMalformed > 0`, counts per failed check (same labels as `listGateFailureReasons`). */
  gateDropReasons?: Array<{ tag: string; count: number }>;
  parseError?: string;
};
