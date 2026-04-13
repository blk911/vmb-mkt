import fs from "node:fs";
import path from "node:path";
import { dataRootAbs } from "@/backend/lib/paths/data-root";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";
import { readImportedSalonRecords } from "@/lib/imported-salon-records/store";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";
import { scoreImportAgainstTarget } from "@/lib/import-diff/match-score";
import type { ComparableImportEntity, ComparisonTargetEntity, MergeTargetSuggestion } from "@/lib/import-diff/types";

type FacilityRow = {
  addressKey?: string;
  businessName?: string;
  placeName?: string;
  website?: string;
  phone?: string;
  ig?: string;
  mapsUrl?: string;
};

type OverrideRow = {
  addressKey: string;
  website?: string | null;
  phone?: string | null;
  ig?: string | null;
  placeName?: string | null;
  mapsUrl?: string | null;
};

function readJsonIfExists<T>(absPath: string): T | null {
  if (!fs.existsSync(absPath)) return null;
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw) as T;
}

function importedDraftToComparable(draft: ImportedProfileDraft): ComparableImportEntity {
  const review = draft.review.payload;
  return {
    id: draft.id,
    entityType: "imported_draft",
    businessName: review.businessName,
    sourceUrl: draft.sourceUrl,
    bookingUrl: review.bookingUrl,
    instagramUrl: review.instagramUrl,
    serviceCount: review.services.length,
    providerCount: review.providers.length,
    portfolioImageCount: review.portfolioImages.length,
  };
}

function importedSalonRecordToComparable(record: ImportedSalonRecord): ComparableImportEntity {
  return {
    id: record.id,
    entityType: "imported_salon_record",
    businessName: record.businessName,
    sourceUrl: record.sourceUrl,
    bookingUrl: record.bookingUrl,
    instagramUrl: record.instagramUrl,
    serviceCount: record.services.length,
    providerCount: record.providers.length,
    portfolioImageCount: record.portfolioImages.length,
  };
}

// Prefer DORA enriched facilities when present; these are the best admin-controlled
// place-level business records in this repo. If the materialized facility files are
// absent locally, we fall back to imported salon records instead of inventing a corpus.
function readAdminSalonTargets(): ComparisonTargetEntity[] {
  const facilitiesAbs = path.join(dataRootAbs(), "co", "dora", "denver_metro", "tables", "vmb_facilities_enriched.json");
  const overridesAbs = path.join(process.cwd(), "data", "co", "dora", "denver_metro", "overrides", "place_overrides.v1.json");

  const facilitiesJson = readJsonIfExists<{ rows?: FacilityRow[] } | FacilityRow[]>(facilitiesAbs);
  const facilityRows = Array.isArray(facilitiesJson)
    ? facilitiesJson
    : Array.isArray(facilitiesJson?.rows)
      ? facilitiesJson.rows
      : [];
  if (!facilityRows.length) return [];

  const overridesJson = readJsonIfExists<{ rows?: OverrideRow[] }>(overridesAbs);
  const overrides = new Map(
    (Array.isArray(overridesJson?.rows) ? overridesJson.rows : []).map((row) => [String(row.addressKey || "").trim(), row])
  );

  return facilityRows.map((row, index) => {
    const addressKey = String(row.addressKey || "").trim();
    const override = overrides.get(addressKey);
    return {
      id: addressKey || `admin_salon_${index + 1}`,
      targetType: "admin_salon" as const,
      businessName: String(override?.placeName || row.placeName || row.businessName || addressKey || "Admin Salon").trim(),
      sourceUrl: String(row.mapsUrl || override?.mapsUrl || "").trim() || undefined,
      bookingUrl: String(override?.website || row.website || "").trim() || undefined,
      instagramUrl: String(override?.ig || row.ig || "").trim() || undefined,
      phone: String(override?.phone || row.phone || "").trim() || undefined,
      address: addressKey || undefined,
      serviceCount: 0,
      providerCount: 0,
      portfolioImageCount: 0,
    };
  });
}

async function readImportedSalonRecordTargets(excludeRecordId?: string): Promise<ComparisonTargetEntity[]> {
  const records = await readImportedSalonRecords();
  return records
    .filter((record) => record.id !== excludeRecordId)
    .map((record) => ({
      id: record.id,
      targetType: "imported_salon_record" as const,
      businessName: record.businessName,
      sourceUrl: record.sourceUrl,
      bookingUrl: record.bookingUrl,
      instagramUrl: record.instagramUrl,
      phone: undefined,
      address: undefined,
      serviceCount: record.services.length,
      providerCount: record.providers.length,
      portfolioImageCount: record.portfolioImages.length,
    }));
}

export async function findMergeTargetsForDraft(draft: ImportedProfileDraft): Promise<{
  suggestions: MergeTargetSuggestion[];
  topTarget: ComparisonTargetEntity | null;
  sourceUsed: "admin_salon" | "imported_salon_record";
}> {
  const imported = importedDraftToComparable(draft);
  const adminTargets = readAdminSalonTargets();
  const targets = adminTargets.length ? adminTargets : await readImportedSalonRecordTargets();
  const sourceUsed = adminTargets.length ? "admin_salon" as const : "imported_salon_record" as const;

  const suggestions = targets
    .map((target) => {
      const result = scoreImportAgainstTarget(imported, target);
      return {
        target,
        suggestion: {
          targetId: target.id,
          targetType: target.targetType,
          businessName: target.businessName,
          score: result.score,
          confidence: result.confidence,
          reasons: result.reasons,
          matchedFields: result.matchedFields,
        } satisfies MergeTargetSuggestion,
      };
    })
    .filter((row) => row.suggestion.score >= 35)
    .sort((a, b) => b.suggestion.score - a.suggestion.score)
    .slice(0, 5);

  return {
    suggestions: suggestions.map((row) => row.suggestion),
    topTarget: suggestions[0]?.target ?? null,
    sourceUsed,
  };
}

export async function findMergeTargetsForImportedSalonRecord(record: ImportedSalonRecord): Promise<{
  suggestions: MergeTargetSuggestion[];
  topTarget: ComparisonTargetEntity | null;
  sourceUsed: "admin_salon" | "imported_salon_record";
}> {
  const imported = importedSalonRecordToComparable(record);
  const adminTargets = readAdminSalonTargets();
  const targets = adminTargets.length ? adminTargets : await readImportedSalonRecordTargets(record.id);
  const sourceUsed = adminTargets.length ? "admin_salon" as const : "imported_salon_record" as const;

  const suggestions = targets
    .map((target) => {
      const result = scoreImportAgainstTarget(imported, target);
      return {
        target,
        suggestion: {
          targetId: target.id,
          targetType: target.targetType,
          businessName: target.businessName,
          score: result.score,
          confidence: result.confidence,
          reasons: result.reasons,
          matchedFields: result.matchedFields,
        } satisfies MergeTargetSuggestion,
      };
    })
    .filter((row) => row.suggestion.score >= 35)
    .sort((a, b) => b.suggestion.score - a.suggestion.score)
    .slice(0, 5);

  return {
    suggestions: suggestions.map((row) => row.suggestion),
    topTarget: suggestions[0]?.target ?? null,
    sourceUsed,
  };
}
