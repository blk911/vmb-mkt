import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { classifyPage } from "./page-classifier";
import { extractFromPage } from "./page-extract";
import { fetchCandidatePage } from "./page-fetch";
import type { PageClassification, SourceRecord } from "./types";

const ACQUISITION_SCAN_ARTIFACT = "runtime-data/operator_acquisition_scan.json";

export type AcquisitionScanRow = {
  sourceUrl: string;
  classifiedType: PageClassification;
  extractedName?: string;
  extractedCity?: string;
  extractedInstagram?: string;
  extractedBooking?: string;
  extractedWebsite?: string;
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
  if (source.booking) return true;
  if (classifiedType === "directory_listing" || classifiedType === "suite_container") return true;
  if (classifiedType === "website") return true;
  return false;
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
    const extracted = fetched.html
      ? extractFromPage(fetched.finalUrl || candidateUrl, fetched.html, candidate)
      : {
          evidenceType: finalClassification,
          name: candidate.name,
          city: candidate.city,
          instagram: candidate.instagram,
          booking: candidate.booking,
          website: candidate.website,
          address: candidate.address,
          phone: candidate.phone,
          parentContainerName: candidate.parentContainerName,
        };

    const enriched: SourceRecord = {
      ...candidate,
      name: extracted.name || candidate.name,
      city: extracted.city || candidate.city,
      address: extracted.address || candidate.address,
      phone: extracted.phone || candidate.phone,
      instagram: extracted.instagram || candidate.instagram,
      booking: extracted.booking || candidate.booking,
      website: extracted.website || candidate.website,
      parentContainerName: extracted.parentContainerName || candidate.parentContainerName,
      evidenceType: extracted.evidenceType || finalClassification,
      sourceUrl: candidateUrl,
      extractedFromUrl: fetched.finalUrl || candidateUrl,
    };

    enrichedRecords.push(enriched);
    scanRows.push({
      sourceUrl: candidateUrl,
      classifiedType: finalClassification,
      extractedName: enriched.name,
      extractedCity: enriched.city,
      extractedInstagram: enriched.instagram,
      extractedBooking: enriched.booking,
      extractedWebsite: enriched.website,
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

