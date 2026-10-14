import type { CandidateProfile } from "@/lib/admin/pipeline/profile-types";
import type { CatalogEvidenceAudit, CatalogFieldCoverage, CatalogRecord } from "./types";

export function profileCoverage(rows: Array<Pick<CatalogRecord, "profile" | "factClaims"> & Partial<Pick<CatalogRecord, "conflicts">>>): CatalogFieldCoverage {
  const totals: CatalogFieldCoverage = { records: rows.length, knownPlatform: 0, multiplePlatforms: 0, booking: 0, social: 0, website: 0, businessName: 0, city: 0, postalCode: 0, factClaims: 0, unresolvedLinks: 0, licenseClaims: 0, unknownWithRecoverableEvidence: 0, conflicts: 0, sourceTruncated: 0 };
  for (const row of rows) {
    const profile: CandidateProfile | undefined = row.profile;
    if (!profile) continue;
    const platforms = new Set(profile.knownPlatforms || profile.bookingLinks.filter((link) => link.attribution !== "unresolved" && link.kind !== "directory").map((link) => link.platform).filter((platform) => platform && platform !== "unknown"));
    if (platforms.size) totals.knownPlatform++;
    if (platforms.size && (!profile.knownPlatforms?.length && profile.platform === "unknown")) totals.unknownWithRecoverableEvidence++;
    if (row.conflicts?.length || profile.reasons.some((reason) => reason.startsWith("conflicting_"))) totals.conflicts++;
    if (profile.reasons.some((reason) => /truncat/i.test(reason))) totals.sourceTruncated++;
    if (platforms.size > 1) totals.multiplePlatforms++;
    if (profile.bookingLinks.some((link) => link.attribution !== "unresolved" && link.kind !== "directory")) totals.booking++;
    if (profile.socialLinks.some((link) => link.attribution !== "unresolved")) totals.social++;
    if (profile.websiteLinks.some((link) => link.attribution !== "unresolved")) totals.website++;
    if (profile.businessName) totals.businessName++;
    if (profile.city) totals.city++;
    if (profile.postalCode) totals.postalCode++;
    totals.factClaims += row.factClaims?.length || 0;
    totals.unresolvedLinks += [...profile.bookingLinks, ...profile.socialLinks, ...profile.websiteLinks].filter((link) => link.attribution === "unresolved").length;
    totals.licenseClaims += row.factClaims?.filter((fact) => fact.kind.startsWith("dora_") || fact.kind.startsWith("license_")).length || 0;
  }
  return totals;
}

/** Both sides use this read snapshot. This is a derived-field audit, never a claim of a historical/live migration. */
export function auditCatalogEvidence(beforeRows: Array<Pick<CatalogRecord, "profile" | "factClaims"> & Partial<Pick<CatalogRecord, "conflicts">>>, rows: CatalogRecord[], expectedIds: string[] = rows.map((row) => row.id), sourceTruncated = 0): CatalogEvidenceAudit {
  const before = profileCoverage(beforeRows), after = profileCoverage(rows);
  before.sourceTruncated = sourceTruncated; after.sourceTruncated = sourceTruncated;
  const expected = new Set(expectedIds), actual = new Set(rows.map((row) => row.id));
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, after[key as keyof CatalogFieldCoverage] - before[key as keyof CatalogFieldCoverage]])) as CatalogFieldCoverage;
  return { version: 2, baseline: "same_snapshot_primary_fields", before, after, delta, derivedOnly: true, sourceDocumentsMutated: 0, baselineDescription: "Direct primary candidate fields and eligible saved profile heads from this same snapshot, before source-lane, staged, and nested legacy reconciliation. Not historical deployment counts.", stableIds: { expected: expectedIds.length, projected: rows.length, unique: actual.size, unchanged: expectedIds.length === rows.length && actual.size === expected.size && [...expected].every((id) => actual.has(id)) }, recoveredUnknownRecords: rows.filter((row, index) => !beforeRows[index]?.profile?.bookingLinks.some((link) => link.platform && link.platform !== "unknown" && link.attribution !== "unresolved" && link.kind !== "directory") && row.profile?.knownPlatforms?.length).length };
}
