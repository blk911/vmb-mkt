import { extractUrlDomain, normalizeAddress, normalizeBusinessName, normalizeBusinessNameTokens, normalizeInstagramHandle, normalizePhone } from "@/lib/import-diff/normalize";
import type { ComparableImportEntity, ComparisonTargetEntity, MatchScoreResult } from "@/lib/import-diff/types";

function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let shared = 0;
  for (const token of aSet) {
    if (bSet.has(token)) shared += 1;
  }
  return shared / Math.max(aSet.size, bSet.size);
}

function confidenceFromScore(score: number): MatchScoreResult["confidence"] {
  if (score >= 85) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

export function scoreImportAgainstTarget(
  imported: ComparableImportEntity,
  target: ComparisonTargetEntity
): MatchScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const matchedFields: MatchScoreResult["matchedFields"] = {};

  const importedName = normalizeBusinessName(imported.businessName);
  const targetName = normalizeBusinessName(target.businessName);
  if (importedName && targetName && importedName === targetName) {
    score += 35;
    reasons.push("Exact normalized business name match");
    matchedFields.businessName = true;
    matchedFields.normalizedName = true;
  } else {
    const overlap = tokenOverlap(normalizeBusinessNameTokens(imported.businessName), normalizeBusinessNameTokens(target.businessName));
    if (overlap >= 0.75) {
      score += 20;
      reasons.push("Strong business name token overlap");
      matchedFields.businessName = true;
    } else if (overlap >= 0.5) {
      score += 12;
      reasons.push("Moderate business name similarity");
    }
  }

  const importedDomains = [extractUrlDomain(imported.bookingUrl), extractUrlDomain(imported.sourceUrl)].filter(Boolean);
  const targetDomains = [extractUrlDomain(target.bookingUrl), extractUrlDomain(target.sourceUrl)].filter(Boolean);
  if (importedDomains.some((domain) => targetDomains.includes(domain))) {
    score += 25;
    reasons.push("Matching booking/source domain");
    matchedFields.bookingDomain = true;
  }

  const importedHandle = normalizeInstagramHandle(imported.instagramUrl);
  const targetHandle = normalizeInstagramHandle(target.instagramUrl);
  if (importedHandle && targetHandle && importedHandle === targetHandle) {
    score += 20;
    reasons.push("Matching Instagram handle");
    matchedFields.instagramHandle = true;
  }

  const importedPhone = normalizePhone(imported.phone);
  const targetPhone = normalizePhone(target.phone);
  if (importedPhone && targetPhone && importedPhone === targetPhone) {
    score += 20;
    reasons.push("Matching phone number");
    matchedFields.phone = true;
  }

  const importedAddress = normalizeAddress(imported.address);
  const targetAddress = normalizeAddress(target.address);
  if (importedAddress && targetAddress) {
    const addressOverlap = tokenOverlap(importedAddress.split(" "), targetAddress.split(" "));
    if (addressOverlap >= 0.75) {
      score += 15;
      reasons.push("Strong address similarity");
      matchedFields.address = true;
    }
  }

  if (imported.sourceUrl && target.sourceUrl && imported.sourceUrl === target.sourceUrl) {
    score += 30;
    reasons.push("Exact source URL match");
    matchedFields.sourceUrl = true;
  }

  score = Math.min(score, 100);
  return {
    score,
    confidence: confidenceFromScore(score),
    reasons,
    matchedFields,
  };
}
