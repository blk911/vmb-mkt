import fs from "node:fs";
import path from "node:path";
import { normalizeCity, normalizeName } from "./normalize";
import type { OperatorRecord, SourceRecord } from "./types";
import { writeJsonFilePretty } from "../social-targets/json-file";

export type OperatorQualitySummary = {
  totalOperators: number;
  hotCount: number;
  shelvedCount: number;
  discardCount: number;
  withInstagramCount: number;
  withBookingCount: number;
  withWebsiteCount: number;
  withInstagramAndBookingCount: number;
  withDirectoryEvidenceCount: number;
  withContainerEvidenceCount: number;
  unknownNameCount: number;
  suspiciousCityCount: number;
  extractedNameImprovementCount: number;
  extractedCityImprovementCount: number;
};

export const OPERATOR_QUALITY_SUMMARY_ARTIFACT = "runtime-data/operator_quality_summary.json";

function operatorEvidence(op: OperatorRecord): SourceRecord[] {
  if (Array.isArray(op.evidence) && op.evidence.length > 0) return op.evidence;
  return [op.sources.google, op.sources.instagram, op.sources.booking].filter(Boolean) as SourceRecord[];
}

function isUnknownOrJunkName(name?: string): boolean {
  const raw = (name || "").trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  if (!normalizeName(raw)) return true;
  if (["unknown", "n/a", "na", "none", "null", "undefined", "test"].includes(normalized)) return true;
  if (/^[a-z0-9_.-]{1,3}$/.test(normalized)) return true;
  if (normalized.startsWith("http")) return true;
  return false;
}

function isSuspiciousCity(city?: string): boolean {
  const raw = (city || "").trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  if (raw.includes('"') || raw.includes("'")) return true;
  if (normalized.includes("site:") || normalized.includes("instagram.com") || normalized.includes("http")) return true;
  if (normalized.includes("/") || normalized.includes("?") || normalized.includes("=")) return true;
  if (normalized.includes(" denver ") || normalized.includes(" nails ") || normalized.includes(" lashes ")) return true;
  return normalizeCity(raw) === undefined;
}

function hasExtractedNameImprovement(op: OperatorRecord): boolean {
  const evidence = operatorEvidence(op);
  const extracted = evidence.filter((e) => Boolean(e.extractedFromUrl)).map((e) => normalizeName(e.name)).filter(Boolean) as string[];
  if (extracted.length === 0) return false;
  const baseline = evidence
    .filter((e) => !e.extractedFromUrl)
    .map((e) => normalizeName(e.name))
    .filter(Boolean) as string[];
  if (baseline.length === 0) return false;
  return extracted.some((next) => !baseline.some((prev) => prev.toLowerCase() === next.toLowerCase()));
}

function hasExtractedCityImprovement(op: OperatorRecord): boolean {
  const evidence = operatorEvidence(op);
  const extracted = evidence
    .filter((e) => Boolean(e.extractedFromUrl))
    .map((e) => normalizeCity(e.city))
    .filter(Boolean) as string[];
  if (extracted.length === 0) return false;
  const baseline = evidence
    .filter((e) => !e.extractedFromUrl)
    .map((e) => normalizeCity(e.city))
    .filter(Boolean) as string[];
  if (baseline.length === 0) return false;
  return extracted.some((next) => !baseline.some((prev) => prev.toLowerCase() === next.toLowerCase()));
}

export function buildOperatorQualitySummary(operators: OperatorRecord[]): OperatorQualitySummary {
  return {
    totalOperators: operators.length,
    hotCount: operators.filter((op) => op.status === "hot").length,
    shelvedCount: operators.filter((op) => op.status === "shelved").length,
    discardCount: operators.filter((op) => op.status === "discard").length,
    withInstagramCount: operators.filter((op) => Boolean(op.canonical.instagram)).length,
    withBookingCount: operators.filter((op) => Boolean(op.canonical.booking)).length,
    withWebsiteCount: operators.filter((op) => Boolean(op.canonical.website)).length,
    withInstagramAndBookingCount: operators.filter((op) => Boolean(op.canonical.instagram && op.canonical.booking)).length,
    withDirectoryEvidenceCount: operators.filter((op) => operatorEvidence(op).some((e) => e.evidenceType === "directory_listing")).length,
    withContainerEvidenceCount: operators.filter((op) => operatorEvidence(op).some((e) => e.evidenceType === "suite_container")).length,
    unknownNameCount: operators.filter((op) => isUnknownOrJunkName(op.name)).length,
    suspiciousCityCount: operators.filter((op) => isSuspiciousCity(op.city)).length,
    extractedNameImprovementCount: operators.filter((op) => hasExtractedNameImprovement(op)).length,
    extractedCityImprovementCount: operators.filter((op) => hasExtractedCityImprovement(op)).length,
  };
}

export function loadMasterOperatorsForQualitySummary(): OperatorRecord[] {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as OperatorRecord[];
}

export async function writeOperatorQualitySummaryArtifact(operators: OperatorRecord[]): Promise<string> {
  const summary = buildOperatorQualitySummary(operators);
  await writeJsonFilePretty(OPERATOR_QUALITY_SUMMARY_ARTIFACT, {
    generatedAt: new Date().toISOString(),
    ...summary,
  });
  return OPERATOR_QUALITY_SUMMARY_ARTIFACT;
}

