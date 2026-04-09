import fs from "node:fs";
import path from "node:path";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { appendEvidence, loadEvidence } from "@/lib/evidence/store";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { extractFromPage } from "@/lib/operators/page-extract";
import { fetchCandidatePage } from "@/lib/operators/page-fetch";
import type { SourceRecord } from "@/lib/operators/types";
import { traverseDirectoryForOperator } from "./directory-traversal";
import { loadResolverRegistry } from "./registry-store";
import { normalizeCity, normalizeName, normalizePhone } from "./normalize";
import { runResolver } from "./run-resolver";
import type { ResolverOperator } from "./types";

const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/directory_detail_surface_recovery_summary.json");

export type DirectoryDetailSurfaceRecoverySummary = {
  generatedAt: string;
  attemptedOperators: number;
  detailPagesFetched: number;
  evidenceAdded: number;
  upgradedWithBooking: number;
  upgradedWithInstagram: number;
  upgradedWithWebsite: number;
  promotedToHot: number;
  promotedToEnriched: number;
};

function writeSummary(summary: DirectoryDetailSurfaceRecoverySummary): void {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

function isProvisionalName(value?: string): boolean {
  const text = (value || "").toLowerCase().trim();
  if (!text) return true;
  if (!text.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text);
}

function isDirectoryBackedEnrichedOperator(op: ResolverOperator): boolean {
  if (op.status !== "enriched") return false;
  if (op.isContainer) return false;
  if (op.parentContainerId && isProvisionalName(op.canonicalName)) return false;
  const hasDirectoryEvidence = op.sources.some(
    (row) => row.source === "directory" || row.evidenceType === "directory_listing"
  );
  if (!hasDirectoryEvidence) return false;
  return !op.canonicalBooking || !op.canonicalInstagram || !op.canonicalWebsite;
}

function inferEvidenceType(extracted: ReturnType<typeof extractFromPage>): SourceRecord["evidenceType"] {
  if (extracted.booking || extracted.instagram || extracted.website) return "direct_operator";
  return extracted.evidenceType;
}

function sameName(a?: string, b?: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return Boolean(left && right && left === right);
}

function sameCity(a?: string, b?: string): boolean {
  const left = normalizeCity(a);
  const right = normalizeCity(b);
  return Boolean(left && right && left === right);
}

function samePhone(a?: string, b?: string): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return Boolean(left && right && left === right);
}

function shouldAcceptExtractedDetail(
  operator: ResolverOperator,
  extracted: ReturnType<typeof extractFromPage>,
  input: { detailUrl: string; fromUrl: string }
): boolean {
  const addsMissingSurface = Boolean(
    (!operator.canonicalBooking && extracted.booking) ||
    (!operator.canonicalInstagram && extracted.instagram) ||
    (!operator.canonicalWebsite && extracted.website)
  );
  if (!addsMissingSurface) return false;

  const anchoredByIdentity =
    sameName(extracted.name, operator.canonicalName) ||
    sameCity(extracted.city, operator.canonicalCity) ||
    samePhone(extracted.phone, operator.canonicalPhone);
  const anchoredByTraversal = input.detailUrl !== input.fromUrl || extracted.evidenceType === "direct_operator";
  return anchoredByIdentity || anchoredByTraversal;
}

function toDetailRecoverySourceRecord(input: {
  operator: ResolverOperator;
  fromUrl: string;
  detailUrl: string;
  extracted: ReturnType<typeof extractFromPage>;
}): SourceRecord {
  return {
    source: "directory",
    operatorType: input.operator.operatorType || (input.operator.parentContainerId ? "child_operator" : "operator"),
    sourceUrl: input.fromUrl,
    extractedFromUrl: input.detailUrl,
    name: input.extracted.name || input.operator.canonicalName,
    city: input.extracted.city || input.operator.canonicalCity,
    category: input.extracted.category || input.operator.category,
    address: input.extracted.address || input.operator.canonicalAddress,
    phone: input.extracted.phone || input.operator.canonicalPhone,
    website: input.extracted.website,
    booking: input.extracted.booking,
    instagram: input.extracted.instagram,
    parentContainerId: input.operator.parentContainerId,
    parentContainerName: input.extracted.parentContainerName || input.operator.parentContainerName,
    evidenceType: inferEvidenceType(input.extracted),
    raw: {
      from: "directory_detail_surface_recovery",
      operatorId: input.operator.id,
      detailUrl: input.detailUrl,
      sourceListingUrl: input.fromUrl,
    },
    extracted: {
      parserUsed: input.extracted.parserUsed,
      detailUrl: input.detailUrl,
      sourceListingUrl: input.fromUrl,
      operatorId: input.operator.id,
      operatorType: input.operator.operatorType || (input.operator.parentContainerId ? "child_operator" : "operator"),
      parentContainerId: input.operator.parentContainerId,
    },
  };
}

function evidenceIdentityKey(row: EvidenceRecord): string {
  const detailUrl =
    row.extracted && typeof row.extracted === "object" && "detailUrl" in (row.extracted as Record<string, unknown>)
      ? String((row.extracted as Record<string, unknown>).detailUrl || "")
      : "";
  const sourceListingUrl =
    row.extracted && typeof row.extracted === "object" && "sourceListingUrl" in (row.extracted as Record<string, unknown>)
      ? String((row.extracted as Record<string, unknown>).sourceListingUrl || "")
      : "";
  return [
    row.source,
    row.sourceUrl || sourceListingUrl,
    detailUrl,
    row.booking || "",
    row.instagram || "",
    row.website || "",
    normalizeName(row.name),
  ].join("|");
}

export async function runDirectoryDetailSurfaceRecovery(opts?: {
  operatorLimit?: number;
  maxDetailPagesPerOperator?: number;
  fetchTimeoutMs?: number;
}): Promise<DirectoryDetailSurfaceRecoverySummary> {
  const operatorLimit = Math.max(1, Math.min(120, opts?.operatorLimit ?? 50));
  const maxDetailPagesPerOperator = Math.max(1, Math.min(8, opts?.maxDetailPagesPerOperator ?? 4));
  const fetchTimeoutMs = Math.max(2000, Math.min(15000, opts?.fetchTimeoutMs ?? 8000));

  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((row) => [row.id, row]));
  const targets = before.filter(isDirectoryBackedEnrichedOperator).slice(0, operatorLimit);

  const existingEvidenceKeys = new Set(loadEvidence().map(evidenceIdentityKey));
  const candidateRecords: SourceRecord[] = [];
  let detailPagesFetched = 0;

  for (const operator of targets) {
    const traversal = await traverseDirectoryForOperator(operator);
    const followOn = traversal.followOn.slice(0, maxDetailPagesPerOperator);
    for (const row of followOn) {
      const fetched = await fetchCandidatePage(row.url, {
        timeoutMs: fetchTimeoutMs,
        referrer: row.fromUrl,
      });
      if (!fetched.statusCode || !fetched.html) continue;
      detailPagesFetched += 1;
      const extracted = extractFromPage(fetched.finalUrl || row.url, fetched.html, {
        source: "directory",
        sourceUrl: row.fromUrl,
        extractedFromUrl: fetched.finalUrl || row.url,
        name: operator.canonicalName,
        city: operator.canonicalCity,
        address: operator.canonicalAddress,
        phone: operator.canonicalPhone,
        website: operator.canonicalWebsite,
        booking: operator.canonicalBooking,
        instagram: operator.canonicalInstagram,
        category: operator.category,
        operatorType: operator.operatorType || (operator.parentContainerId ? "child_operator" : "operator"),
        parentContainerId: operator.parentContainerId,
        parentContainerName: operator.parentContainerName,
        evidenceType: "directory_listing",
      });
      if (!shouldAcceptExtractedDetail(operator, extracted, { detailUrl: fetched.finalUrl || row.url, fromUrl: row.fromUrl })) {
        continue;
      }
      const record = toDetailRecoverySourceRecord({
        operator,
        fromUrl: row.fromUrl,
        detailUrl: fetched.finalUrl || row.url,
        extracted,
      });
      const evidenceRows = sourceRecordsToEvidence([record]);
      const key = evidenceIdentityKey(evidenceRows[0]);
      if (existingEvidenceKeys.has(key)) continue;
      existingEvidenceKeys.add(key);
      candidateRecords.push(record);
    }
  }

  const evidenceRows = sourceRecordsToEvidence(candidateRecords);
  if (evidenceRows.length) appendEvidence(evidenceRows);
  const after = evidenceRows.length ? runResolver() : before;
  const afterMap = new Map(after.map((row) => [row.id, row]));

  let upgradedWithBooking = 0;
  let upgradedWithInstagram = 0;
  let upgradedWithWebsite = 0;
  let promotedToHot = 0;
  let promotedToEnriched = 0;
  for (const target of targets) {
    const pre = beforeMap.get(target.id);
    const post = afterMap.get(target.id);
    if (!pre || !post) continue;
    if (!pre.canonicalBooking && post.canonicalBooking) upgradedWithBooking += 1;
    if (!pre.canonicalInstagram && post.canonicalInstagram) upgradedWithInstagram += 1;
    if (!pre.canonicalWebsite && post.canonicalWebsite) upgradedWithWebsite += 1;
    if (pre.status !== "hot" && post.status === "hot") promotedToHot += 1;
    if ((pre.status === "enumerated" || pre.status === "shelved") && post.status === "enriched") {
      promotedToEnriched += 1;
    }
  }

  const summary: DirectoryDetailSurfaceRecoverySummary = {
    generatedAt: new Date().toISOString(),
    attemptedOperators: targets.length,
    detailPagesFetched,
    evidenceAdded: evidenceRows.length,
    upgradedWithBooking,
    upgradedWithInstagram,
    upgradedWithWebsite,
    promotedToHot,
    promotedToEnriched,
  };
  writeSummary(summary);
  return summary;
}

if (require.main === module) {
  runDirectoryDetailSurfaceRecovery()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}
