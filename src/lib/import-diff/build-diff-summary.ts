import { extractUrlDomain, normalizeInstagramHandle } from "@/lib/import-diff/normalize";
import type {
  ComparableImportEntity,
  ComparisonTargetEntity,
  DiffFieldChange,
  DiffSummary,
  MergeTargetSuggestion,
} from "@/lib/import-diff/types";

function compareField(
  field: string,
  importedValue?: string | number | null,
  targetValue?: string | number | null
): DiffFieldChange {
  if ((importedValue === undefined || importedValue === null || importedValue === "") && (targetValue === undefined || targetValue === null || targetValue === "")) {
    return { field, importedValue: null, targetValue: null, status: "same" };
  }
  if (importedValue === undefined || importedValue === null || importedValue === "") {
    return { field, importedValue: null, targetValue: targetValue ?? null, status: "missing_imported" };
  }
  if (targetValue === undefined || targetValue === null || targetValue === "") {
    return { field, importedValue, targetValue: null, status: "missing_target" };
  }
  return {
    field,
    importedValue,
    targetValue,
    status: String(importedValue) === String(targetValue) ? "same" : "different",
  };
}

export function buildDiffSummary(args: {
  imported: ComparableImportEntity;
  topSuggestion?: MergeTargetSuggestion | null;
  target?: ComparisonTargetEntity | null;
}): DiffSummary {
  const { imported, topSuggestion, target } = args;
  const fieldChanges: DiffFieldChange[] = target
    ? [
        compareField("Business Name", imported.businessName, target.businessName),
        compareField("Booking Domain", extractUrlDomain(imported.bookingUrl || imported.sourceUrl), extractUrlDomain(target.bookingUrl || target.sourceUrl)),
        compareField("Instagram Handle", normalizeInstagramHandle(imported.instagramUrl), normalizeInstagramHandle(target.instagramUrl)),
        compareField("Phone", imported.phone, target.phone),
        compareField("Address", imported.address, target.address),
        compareField("Service Count", imported.serviceCount, target.serviceCount),
        compareField("Provider Count", imported.providerCount, target.providerCount),
        compareField("Portfolio Image Count", imported.portfolioImageCount, target.portfolioImageCount),
      ]
    : [];

  const warnings: string[] = [];
  if (!imported.instagramUrl) warnings.push("Imported entity has no social links.");
  if (topSuggestion?.matchedFields.normalizedName && topSuggestion?.matchedFields.bookingDomain) {
    warnings.push("Likely duplicate name/domain combination.");
  }
  if (topSuggestion?.matchedFields.instagramHandle && !topSuggestion?.matchedFields.normalizedName) {
    warnings.push("Same Instagram handle but business naming differs.");
  }
  if (target && target.providerCount > imported.providerCount) {
    warnings.push("Target has richer provider data.");
  }
  if (target && imported.serviceCount > target.serviceCount) {
    warnings.push("Imported entity has more recent-looking service detail.");
  }

  return {
    importedEntityLabel: imported.businessName,
    targetEntityLabel: target?.businessName,
    topSuggestion: topSuggestion ?? undefined,
    fieldChanges,
    warnings,
  };
}
