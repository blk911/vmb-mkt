/**
 * Shared row parsing / validation for Live Units (any source).
 *
 * Required-field gate (exact key names, all must pass):
 * - `live_unit_id` — non-empty string (after trim)
 * - `name_display` — string (may be empty string)
 * - `signal_mix` — string
 * - `entity_score` — finite number (not NaN)
 *
 * Top-level JSON must include `{ "rows": [ ... ] }`.
 */

/** Minimal shape required for LiveUnitsClient / filters */
export function passesRequiredFields(row: unknown): boolean {
  if (row === null || typeof row !== "object") return false;
  const o = row as Record<string, unknown>;
  const id = o.live_unit_id;
  if (typeof id !== "string" || !id.trim()) return false;
  if (typeof o.name_display !== "string") return false;
  if (typeof o.signal_mix !== "string") return false;
  if (typeof o.entity_score !== "number" || Number.isNaN(o.entity_score)) return false;
  return true;
}

/**
 * Which gate checks failed — mirrors `passesRequiredFields` (one row can fail multiple checks).
 * Tags are stable for aggregation in load traces / `/api/admin/live-units/dataset`.
 */
export function listGateFailureReasons(row: unknown): string[] {
  if (row === null || typeof row !== "object") return ["row_not_object"];
  const o = row as Record<string, unknown>;
  const reasons: string[] = [];
  const id = o.live_unit_id;
  if (typeof id !== "string" || !id.trim()) reasons.push("live_unit_id");
  if (typeof o.name_display !== "string") reasons.push("name_display");
  if (typeof o.signal_mix !== "string") reasons.push("signal_mix");
  const es = o.entity_score;
  if (typeof es !== "number" || Number.isNaN(es)) reasons.push("entity_score");
  return reasons;
}

/** Sorted by count descending — only rows that fail the gate contribute. */
export function aggregateGateDropReasons(rawRows: unknown[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rawRows) {
    if (passesRequiredFields(row)) continue;
    for (const tag of listGateFailureReasons(row)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function gateLiveUnitRows(rawRows: unknown[]): {
  gated: unknown[];
  droppedMalformed: number;
} {
  const gated: unknown[] = [];
  let droppedMalformed = 0;
  for (const row of rawRows) {
    if (passesRequiredFields(row)) gated.push(row);
    else droppedMalformed += 1;
  }
  return { gated, droppedMalformed };
}

export function extractRowsArray(payload: unknown): unknown[] {
  if (payload === null || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  return Array.isArray(o.rows) ? o.rows : [];
}
