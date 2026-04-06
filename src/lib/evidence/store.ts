import fs from "node:fs";
import path from "node:path";
import type { EvidenceRecord } from "./types";

const EVIDENCE_LAKE_PATH = path.join(process.cwd(), "runtime-data/evidence_lake.v1.json");

export function loadEvidence(): EvidenceRecord[] {
  if (!fs.existsSync(EVIDENCE_LAKE_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(EVIDENCE_LAKE_PATH, "utf-8")) as unknown;
  return Array.isArray(parsed) ? (parsed as EvidenceRecord[]) : [];
}

export function appendEvidence(records: EvidenceRecord[]): void {
  if (!records.length) return;
  const existing = loadEvidence();
  const next = [...existing, ...records];
  fs.mkdirSync(path.dirname(EVIDENCE_LAKE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_LAKE_PATH, `${JSON.stringify(next, null, 2)}\n`);
}

