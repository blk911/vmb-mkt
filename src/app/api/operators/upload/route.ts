import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adaptUploadRecords, type RawUploadRecord } from "@/lib/operators/upload-adapter";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { appendEvidence, loadEvidence } from "@/lib/evidence/store";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { loadResolverRegistry } from "@/lib/resolver/registry-store";
import { normalizeAddress, normalizeCity, normalizeDomain, normalizeName, normalizePhone } from "@/lib/resolver/normalize";
import { runResolver } from "@/lib/resolver/run-resolver";

export const runtime = "nodejs";

const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/upload_summary.json");

type UploadSummary = {
  generatedAt: string;
  recordsReceived: number;
  recordsAccepted: number;
  evidenceAdded: number;
  doraRowsAccepted: number;
  doraRowsRejected: number;
  doraRowsMerged: number;
  doraRowsCreatedAsNewOperators: number;
  operatorsCreated: number;
  operatorsMerged: number;
  operatorsUpgraded: {
    hot: number;
    enriched: number;
  };
};

function writeSummary(summary: UploadSummary): void {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

function toEvidenceIdentityKey(row: EvidenceRecord): string {
  const normalizeUrlish = (value?: string): string => {
    if (!value) return "";
    try {
      const parsed = new URL(value);
      parsed.hash = "";
      parsed.search = "";
      return parsed.toString().replace(/\/+$/, "");
    } catch {
      return value.trim().toLowerCase();
    }
  };

  const sourceNote =
    row.raw && typeof row.raw === "object" && "sourceNote" in (row.raw as Record<string, unknown>)
      ? String((row.raw as Record<string, unknown>).sourceNote || "")
      : "";
  const licenseNumber =
    row.raw && typeof row.raw === "object" && "licenseNumber" in (row.raw as Record<string, unknown>)
      ? String((row.raw as Record<string, unknown>).licenseNumber || "")
      : "";

  return [
    row.source,
    sourceNote,
    licenseNumber,
    normalizeUrlish(row.sourceUrl),
    normalizeName(row.name),
    normalizeCity(row.city),
    normalizeAddress(row.address),
    normalizePhone(row.phone),
    normalizeUrlish(row.website) || normalizeDomain(row.website),
    normalizeUrlish(row.booking) || normalizeDomain(row.booking),
    normalizeUrlish(row.instagram) || normalizeDomain(row.instagram),
  ].join("|");
}

function extractRecords(body: unknown): RawUploadRecord[] | null {
  if (Array.isArray(body)) return body.filter((row): row is RawUploadRecord => Boolean(row && typeof row === "object"));
  if (body && typeof body === "object" && Array.isArray((body as { records?: unknown[] }).records)) {
    return (body as { records: unknown[] }).records.filter((row): row is RawUploadRecord => Boolean(row && typeof row === "object"));
  }
  return null;
}

function batchId(): string {
  return `upload_${crypto.randomUUID()}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const records = extractRecords(body);
  if (!records) {
    return NextResponse.json({ ok: false as const, error: "records_array_required" }, { status: 400 });
  }
  if (!records.length) {
    return NextResponse.json({ ok: false as const, error: "records_empty" }, { status: 400 });
  }

  try {
    const uploadBatchId = batchId();
    const beforeRegistry = loadResolverRegistry();
    const beforeMap = new Map(beforeRegistry.map((row) => [row.id, row]));
    const existingKeys = new Set(loadEvidence().map(toEvidenceIdentityKey));

    const adapted = adaptUploadRecords(records, { uploadBatchId });
    const candidateEvidence = sourceRecordsToEvidence(adapted.sourceRecords);
    const uniqueEvidence: EvidenceRecord[] = [];
    const batchKeys = new Set<string>();
    for (const row of candidateEvidence) {
      const key = toEvidenceIdentityKey(row);
      if (existingKeys.has(key) || batchKeys.has(key)) continue;
      batchKeys.add(key);
      uniqueEvidence.push(row);
    }

    if (uniqueEvidence.length) appendEvidence(uniqueEvidence);
    const afterRegistry = uniqueEvidence.length ? runResolver() : beforeRegistry;
    const touched = afterRegistry.filter((operator) =>
      operator.sources.some((row) => {
        if (!row.raw || typeof row.raw !== "object") return false;
        return (
          (row.raw as Record<string, unknown>).from === "manual_upload" &&
          (row.raw as Record<string, unknown>).uploadBatchId === uploadBatchId
        );
      })
    );

    let operatorsCreated = 0;
    let operatorsMerged = 0;
    let doraRowsMerged = 0;
    let doraRowsCreatedAsNewOperators = 0;
    let upgradedHot = 0;
    let upgradedEnriched = 0;
    for (const operator of touched) {
      const before = beforeMap.get(operator.id);
      const touchedByDoraUpload = operator.sources.some((row) => {
        if (!row.raw || typeof row.raw !== "object") return false;
        return (
          (row.raw as Record<string, unknown>).from === "manual_upload" &&
          (row.raw as Record<string, unknown>).uploadBatchId === uploadBatchId &&
          (row.raw as Record<string, unknown>).sourceNote === "dora_license"
        );
      });
      if (before) operatorsMerged += 1;
      else operatorsCreated += 1;
      if (touchedByDoraUpload) {
        if (before) doraRowsMerged += 1;
        else doraRowsCreatedAsNewOperators += 1;
      }

      const previousStatus = before?.status;
      if (operator.status === "hot" && previousStatus !== "hot") upgradedHot += 1;
      if (operator.status === "enriched" && previousStatus !== "enriched" && previousStatus !== "hot") upgradedEnriched += 1;
    }

    const summary: UploadSummary = {
      generatedAt: new Date().toISOString(),
      recordsReceived: adapted.receivedCount,
      recordsAccepted: adapted.acceptedCount,
      evidenceAdded: uniqueEvidence.length,
      doraRowsAccepted: adapted.doraAcceptedCount,
      doraRowsRejected: adapted.doraRejectedCount,
      doraRowsMerged,
      doraRowsCreatedAsNewOperators,
      operatorsCreated,
      operatorsMerged,
      operatorsUpgraded: {
        hot: upgradedHot,
        enriched: upgradedEnriched,
      },
    };
    writeSummary(summary);

    return NextResponse.json(
      {
        ok: true as const,
        summary,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
