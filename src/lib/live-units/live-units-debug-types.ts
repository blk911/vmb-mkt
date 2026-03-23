/**
 * Server-side load tracing for Live Units — diagnostics only.
 */

export type LiveUnitsArtifactSource = "shop_context" | "tuned" | "base";

export type LiveUnitsLoadAttempt = {
  source: LiveUnitsArtifactSource;
  /** Absolute or cwd-relative path attempted */
  path: string;
  fileExists: boolean;
  /** Length of `rows` array when file existed and parsed */
  rawRowsInFile: number;
};

export type LiveUnitsLoadTrace = {
  cwd: string;
  attempts: LiveUnitsLoadAttempt[];
  chosenSource: LiveUnitsArtifactSource | null;
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
  parseError?: string;
};
