import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { classifyPage } from "./page-classifier";
import { extractFromPage } from "./page-extract";
import { fetchCandidatePage } from "./page-fetch";
import type { PageClassification, SourceRecord } from "./types";

const ACQUISITION_SCAN_ARTIFACT = "runtime-data/operator_acquisition_scan.json";

export type AcquisitionScanRow = {
  sourceUrl: string;
  classifiedType: PageClassification;
  parserUsed?: string;
  originalName?: string;
  originalCity?: string;
  extractedName?: string;
  extractedCity?: string;
  extractedInstagram?: string;
  extractedBooking?: string;
  extractedWebsite?: string;
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

export async function runAcquisition(candidates: SourceRecord[]): Promise<AcquisitionRunOutput> {
  const enrichedRecords: SourceRecord[] = [];
  const scanRows: AcquisitionScanRow[] = [];

  for (const candidate of candidates) {
    const candidateUrl = getCandidateUrl(candidate);
    if (!candidateUrl) continue;

    const urlClassification = classifyPage(candidateUrl);
    if (!shouldScanSource(candidate, urlClassification)) continue;

    const fetched = await fetchCandidatePage(candidateUrl);
    const finalClassification = classifyPage(fetched.finalUrl || candidateUrl, fetched.html);
    const extracted = extractFromPage(fetched.finalUrl || candidateUrl, fetched.html || "", candidate);

    const enriched: SourceRecord = {
      ...candidate,
      source: sourceFromEvidenceType(extracted.evidenceType || finalClassification, candidate.source),
      name: extracted.name || candidate.name,
      city: extracted.city || candidate.city,
      address: extracted.address || candidate.address,
      phone: extracted.phone || candidate.phone,
      instagram: extracted.instagram || candidate.instagram,
      booking: extracted.booking || candidate.booking,
      website: extracted.website || candidate.website,
      parentContainerName: extracted.parentContainerName || candidate.parentContainerName,
      evidenceType: extracted.evidenceType || finalClassification,
      childQuerySeeds: extracted.childQuerySeeds || candidate.childQuerySeeds,
      sourceUrl: candidateUrl,
      extractedFromUrl: fetched.finalUrl || candidateUrl,
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
      childQuerySeeds: enriched.childQuerySeeds,
      statusCode: fetched.statusCode,
    });
  }

  await writeJsonFilePretty(ACQUISITION_SCAN_ARTIFACT, {
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    scannedPages: scanRows.length,
    scans: scanRows,
  });

  return {
    enrichedRecords,
    scanRows,
    artifactPath: ACQUISITION_SCAN_ARTIFACT,
  };
}

