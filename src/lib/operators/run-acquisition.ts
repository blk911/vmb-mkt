import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { runContainerExtraction } from "@/lib/containers/run-container-extraction";
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
};

export type AcquisitionRunOutput = {
  enrichedRecords: SourceRecord[];
  scanRows: AcquisitionScanRow[];
  artifactPath: string;
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
  opts?: { artifactPath?: string }
): Promise<AcquisitionRunOutput> {
  const enrichedRecords: SourceRecord[] = [];
  const scanRows: AcquisitionScanRow[] = [];
  const artifactPath = opts?.artifactPath || ACQUISITION_SCAN_ARTIFACT;

  for (const candidate of candidates) {
    const candidateUrl = getCandidateUrl(candidate);
    if (!candidateUrl) continue;

    const urlClassification = classifyPage(candidateUrl);
    if (!shouldScanSource(candidate, urlClassification)) continue;

    const fetched = await fetchCandidatePage(candidateUrl);
    const resolvedUrl = fetched.finalUrl || candidateUrl;
    const finalClassification = classifyPage(resolvedUrl, fetched.html);
    const containerExtraction = runContainerExtraction({
      sourceUrl: resolvedUrl,
      html: fetched.html || "",
      candidate,
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
      });
      continue;
    }
    const extracted = extractFromPage(resolvedUrl, fetched.html || "", candidate);

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
    });
  }

  await writeJsonFilePretty(artifactPath, {
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    scannedPages: scanRows.length,
    scans: scanRows,
  });

  return {
    enrichedRecords,
    scanRows,
    artifactPath,
  };
}

