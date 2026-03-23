/**
 * Shared row parsing / validation for Live Units (any source).
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
