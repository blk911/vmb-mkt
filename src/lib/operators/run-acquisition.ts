import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { runContainerExtraction } from "@/lib/containers/run-container-extraction";
import type { RuntimeTraceLogger } from "@/lib/resolver/runtime-trace";
import { classifyPage } from "./page-classifier";
import { extractFromPage } from "./page-extract";
import { fetchCandidatePage } from "./page-fetch";
import type { PageClassification, SourceRecord } from "./types";

const ACQUISITION_SCAN_ARTIFACT = "runtime-data/operator_acquisition_scan.json";

export type AcquisitionScanRow = {
  sourceUrl: string;
  classifiedType: PageClassification;
  parserUsed?: string;
  parentContainerId?: string;
  originalName?: string;
  originalCity?: string;
  extractedName?: string;
  extractedCity?: string;
  extractedInstagram?: string;
  extractedBooking?: string;
  extractedWebsite?: string;
  extractedTenantCount?: number;
  followOnDetailUrls?: string[];
  hasDirectSurface?: boolean;
  childQuerySeeds?: string[];
  statusCode: number;
  fetchOutcome?: "success" | "timeout" | "error" | "skipped";
  elapsedMs?: number;
  note?: string;
};

export type AcquisitionRunOutput = {
  enrichedRecords: SourceRecord[];
  scanRows: AcquisitionScanRow[];
  artifactPath: string;
  processedCandidates: number;
  fetchTimeouts: number;
  fetchErrors: number;
  budgetExceeded: boolean;
};

function getCandidateUrl(source: SourceRecord): string | undefined {
  return source.sourceUrl || source.booking || source.website || source.instagram;
}

function shouldScanSource(source: SourceRecord, classifiedType: PageClassification): boolean {
  if (source.source === "directory" || source.source === "container") return true;
  if (source.booking) return true;
  if (classifiedType === "directory_listing" || classifiedType === "suite_container") return true;
  if (classifiedType === "website") return true;
  return false;
}

function sourceFromEvidenceType(evidenceType: PageClassification, fallback: SourceRecord["source"]): SourceRecord["source"] {
  if (evidenceType === "directory_listing") return "directory";
  if (evidenceType === "suite_container") return "container";
  return fallback;
}

export async function runAcquisition(
  candidates: SourceRecord[],
  opts?: {
    artifactPath?: string;
    writeArtifact?: boolean;
    safeRuntime?: boolean;
    fetchTimeoutMs?: number;
    maxRuntimeMs?: number;
    traceLogger?: RuntimeTraceLogger;
  }
): Promise<AcquisitionRunOutput> {
  const enrichedRecords: SourceRecord[] = [];
  const scanRows: AcquisitionScanRow[] = [];
  const artifactPath = opts?.artifactPath || ACQUISITION_SCAN_ARTIFACT;
  const startedAt = Date.now();
  let fetchTimeouts = 0;
  let fetchErrors = 0;
  let processedCandidates = 0;
  let budgetExceeded = false;

  for (const candidate of candidates) {
    if (opts?.safeRuntime && opts?.maxRuntimeMs && Date.now() - startedAt >= opts.maxRuntimeMs) {
      budgetExceeded = true;
      opts.traceLogger?.log({
        operatorId:
          candidate.raw && typeof candidate.raw === "object" && "operatorId" in (candidate.raw as Record<string, unknown>)
            ? String((candidate.raw as Record<string, unknown>).operatorId || "")
            : undefined,
        operatorName: candidate.name,
        query:
          candidate.raw && typeof candidate.raw === "object" && "query" in (candidate.raw as Record<string, unknown>)
            ? String((candidate.raw as Record<string, unknown>).query || "")
            : undefined,
        intent:
          candidate.raw && typeof candidate.raw === "object" && "from" in (candidate.raw as Record<string, unknown>)
            ? String((candidate.raw as Record<string, unknown>).from || "")
            : undefined,
        candidateStrength:
          candidate.raw && typeof candidate.raw === "object" && "candidateStrength" in (candidate.raw as Record<string, unknown>)
            ? Number((candidate.raw as Record<string, unknown>).candidateStrength || 0)
            : undefined,
        stage: "acquisition_budget",
        status: "timeout",
        elapsedMs: Date.now() - startedAt,
        note: `maxRuntimeMs=${opts.maxRuntimeMs}`,
      });
      break;
    }

    const candidateUrl = getCandidateUrl(candidate);
    const operatorId =
      candidate.raw && typeof candidate.raw === "object" && "operatorId" in (candidate.raw as Record<string, unknown>)
        ? String((candidate.raw as Record<string, unknown>).operatorId || "")
        : undefined;
    const query =
      candidate.raw && typeof candidate.raw === "object" && "query" in (candidate.raw as Record<string, unknown>)
        ? String((candidate.raw as Record<string, unknown>).query || "")
        : undefined;
    const intent =
      candidate.raw && typeof candidate.raw === "object" && "from" in (candidate.raw as Record<string, unknown>)
        ? String((candidate.raw as Record<string, unknown>).from || "")
        : undefined;
    const candidateStrength =
      candidate.raw && typeof candidate.raw === "object" && "candidateStrength" in (candidate.raw as Record<string, unknown>)
        ? Number((candidate.raw as Record<string, unknown>).candidateStrength || 0)
        : undefined;

    if (!candidateUrl) {
      opts?.traceLogger?.log({
        operatorId,
        operatorName: candidate.name,
        query,
        intent,
        candidateStrength,
        stage: "acquisition_candidate",
        status: "skipped",
        note: "missing_candidate_url",
      });
      continue;
    }

    const urlClassification = classifyPage(candidateUrl);
    if (!shouldScanSource(candidate, urlClassification)) {
      opts?.traceLogger?.log({
        operatorId,
        operatorName: candidate.name,
        query,
        intent,
        candidateStrength,
        stage: "acquisition_candidate",
        status: "skipped",
        url: candidateUrl,
        note: `classifiedType=${urlClassification}`,
      });
      continue;
    }

    const acquisitionStartedAt = Date.now();
    processedCandidates += 1;
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "acquisition_candidate",
      status: "start",
      url: candidateUrl,
      note: `classifiedType=${urlClassification}`,
    });

    const fetched = await fetchCandidatePage(candidateUrl, {
      timeoutMs: opts?.fetchTimeoutMs,
      traceLogger: opts?.traceLogger,
      traceContext: {
        operatorId,
        operatorName: candidate.name,
        query,
        intent,
        candidateStrength,
      },
    });
    if (fetched.timedOut) fetchTimeouts += 1;
    if (fetched.error && !fetched.timedOut && fetched.error !== "unsupported_or_invalid_host") fetchErrors += 1;
    const resolvedUrl = fetched.finalUrl || candidateUrl;
    if (!fetched.statusCode || (!fetched.html && !fetched.contentType)) {
      scanRows.push({
        sourceUrl: candidateUrl,
        classifiedType: urlClassification,
        originalName: candidate.name,
        originalCity: candidate.city,
        statusCode: fetched.statusCode,
        fetchOutcome: fetched.timedOut ? "timeout" : fetched.error ? "error" : "skipped",
        elapsedMs: fetched.elapsedMs,
        note: fetched.error,
      });
      opts?.traceLogger?.log({
        operatorId,
        operatorName: candidate.name,
        query,
        intent,
        candidateStrength,
        stage: "acquisition_candidate",
        status: fetched.timedOut ? "timeout" : fetched.error ? "error" : "skipped",
        elapsedMs: Date.now() - acquisitionStartedAt,
        url: candidateUrl,
        note: fetched.error || "empty_fetch_result",
      });
      continue;
    }

    const finalClassification = classifyPage(resolvedUrl, fetched.html);
    const containerStartedAt = Date.now();
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "container_extraction",
      status: "start",
      url: resolvedUrl,
    });
    const containerExtraction = await runContainerExtraction({
      sourceUrl: resolvedUrl,
      html: fetched.html || "",
      candidate,
    });
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "container_extraction",
      status: "success",
      elapsedMs: Date.now() - containerStartedAt,
      url: resolvedUrl,
      note: containerExtraction.detected ? `tenants=${containerExtraction.tenantCandidates.length}` : "not_detected",
    });
    if (containerExtraction.detected) {
      const containerInfrastructure: SourceRecord = {
        ...candidate,
        source: "container",
        operatorType: "container",
        parentContainerId: containerExtraction.parentContainerId,
        parentContainerName: containerExtraction.parentContainerName || candidate.parentContainerName || candidate.name,
        evidenceType: "suite_container",
        sourceUrl: resolvedUrl,
        extractedFromUrl: resolvedUrl,
        extracted: {
          ...(candidate.extracted && typeof candidate.extracted === "object" ? (candidate.extracted as Record<string, unknown>) : {}),
          parserUsed: `container:${containerExtraction.strategy || "generic"}`,
          followOnDetailUrls: containerExtraction.followOnDetailUrls,
          parentContainerId: containerExtraction.parentContainerId,
          extractedTenantCount: containerExtraction.tenantCandidates.length,
        },
      };
      enrichedRecords.push(containerInfrastructure);
      enrichedRecords.push(...containerExtraction.tenantCandidates);
      scanRows.push({
        sourceUrl: candidateUrl,
        classifiedType: "suite_container",
        parserUsed: `container:${containerExtraction.strategy || "generic"}`,
        parentContainerId: containerExtraction.parentContainerId,
        originalName: candidate.name,
        originalCity: candidate.city,
        extractedName: containerExtraction.parentContainerName || candidate.name,
        extractedCity: candidate.city,
        extractedTenantCount: containerExtraction.tenantCandidates.length,
        followOnDetailUrls: containerExtraction.followOnDetailUrls.slice(0, 10),
        extractedInstagram: undefined,
        extractedBooking: undefined,
        extractedWebsite: candidate.website,
        hasDirectSurface: false,
        childQuerySeeds: candidate.childQuerySeeds,
        statusCode: fetched.statusCode,
        fetchOutcome: "success",
        elapsedMs: fetched.elapsedMs,
      });
      opts?.traceLogger?.log({
        operatorId,
        operatorName: candidate.name,
        query,
        intent,
        candidateStrength,
        stage: "acquisition_candidate",
        status: "success",
        elapsedMs: Date.now() - acquisitionStartedAt,
        url: resolvedUrl,
        note: "container_detected",
      });
      continue;
    }
    const extractStartedAt = Date.now();
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "hydrate_extract",
      status: "start",
      url: resolvedUrl,
    });
    const extracted = extractFromPage(resolvedUrl, fetched.html || "", candidate);
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "hydrate_extract",
      status: "success",
      elapsedMs: Date.now() - extractStartedAt,
      url: resolvedUrl,
      note: extracted.parserUsed || extracted.evidenceType,
    });

    const enriched: SourceRecord = {
      ...candidate,
      operatorType: candidate.operatorType || "operator",
      source: sourceFromEvidenceType(extracted.evidenceType || finalClassification, candidate.source),
      name: extracted.name || candidate.name,
      city: extracted.city || candidate.city,
      address: extracted.address || candidate.address,
      phone: extracted.phone || candidate.phone,
      instagram: extracted.instagram || candidate.instagram,
      booking: extracted.booking || candidate.booking,
      website: extracted.website || candidate.website,
      parentContainerName: extracted.parentContainerName || candidate.parentContainerName,
      parentContainerId: candidate.parentContainerId,
      evidenceType: extracted.evidenceType || finalClassification,
      childQuerySeeds: extracted.childQuerySeeds || candidate.childQuerySeeds,
      sourceUrl: candidateUrl,
      extractedFromUrl: resolvedUrl,
      raw: candidate.raw,
      extracted: {
        ...(candidate.extracted && typeof candidate.extracted === "object" ? (candidate.extracted as Record<string, unknown>) : {}),
        parserUsed: extracted.parserUsed,
        internalDetailLinks: extracted.internalDetailLinks,
        operatorType: candidate.operatorType || "operator",
        parentContainerId: candidate.parentContainerId,
      },
    };

    enrichedRecords.push(enriched);
    scanRows.push({
      sourceUrl: candidateUrl,
      classifiedType: finalClassification,
      parserUsed: extracted.parserUsed,
      originalName: candidate.name,
      originalCity: candidate.city,
      extractedName: enriched.name,
      extractedCity: enriched.city,
      extractedInstagram: enriched.instagram,
      extractedBooking: enriched.booking,
      extractedWebsite: enriched.website,
      hasDirectSurface: Boolean(enriched.instagram || enriched.booking || enriched.website),
      childQuerySeeds: enriched.childQuerySeeds,
      statusCode: fetched.statusCode,
      fetchOutcome: "success",
      elapsedMs: fetched.elapsedMs,
    });
    opts?.traceLogger?.log({
      operatorId,
      operatorName: candidate.name,
      query,
      intent,
      candidateStrength,
      stage: "acquisition_candidate",
      status: "success",
      elapsedMs: Date.now() - acquisitionStartedAt,
      url: resolvedUrl,
      note: Boolean(enriched.instagram || enriched.booking || enriched.website) ? "direct_surface_found" : "supporting_detail_only",
    });
  }

  if (opts?.writeArtifact !== false) {
    await writeJsonFilePretty(artifactPath, {
      generatedAt: new Date().toISOString(),
      totalCandidates: candidates.length,
      scannedPages: scanRows.length,
      scans: scanRows,
    });
  }

  return {
    enrichedRecords,
    scanRows,
    artifactPath,
    processedCandidates,
    fetchTimeouts,
    fetchErrors,
    budgetExceeded,
  };
}

