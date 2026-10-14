import { createHash } from "node:crypto";
import type { StagedOperatorEvidence } from "./types";

export function stableEvidenceValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableEvidenceValue).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => (value as Record<string, unknown>)[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableEvidenceValue((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function factPayload(row: StagedOperatorEvidence): Record<string, unknown> {
  const { id: _id, observedAt: _observedAt, ...payload } = row;
  return payload;
}
/** Only newly generated rows use this identity; existing legacy IDs are never rewritten. */
export function stableStagedEvidenceId(row: StagedOperatorEvidence): string {
  return `soe_v2_${createHash("sha256").update(stableEvidenceValue(factPayload(row))).digest("hex")}`;
}
export function withStableStagedEvidenceId(row: StagedOperatorEvidence): StagedOperatorEvidence {
  return { ...row, id: stableStagedEvidenceId(row) };
}
/** A retry retains the first immutable observation time. Changed facts/provenance have a different ID. */
export function sameStagedEvidence(a: StagedOperatorEvidence, b: StagedOperatorEvidence): boolean {
  if (stableEvidenceValue(a) === stableEvidenceValue(b)) return true;
  return a.id === b.id && a.id.startsWith("soe_v2_") && stableStagedEvidenceId(a) === a.id && stableStagedEvidenceId(b) === b.id && stableEvidenceValue(factPayload(a)) === stableEvidenceValue(factPayload(b));
}
