import type { CatalogRecord } from "@/lib/catalog/types";
import type { DoraCrossReference, DoraCrossReferenceRecord, DoraLicenseClaim, DoraSubject } from "./types";
import { DORA_DATASET_PAGE, DORA_LICENSE_TYPES, emptyDoraCrossReference, normalizeDoraName, normalizeDoraNumber, officialDoraSourceUrl, matchDoraRecords } from "./model";
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only explicit candidate-scoped fields on an independent public source can corroborate identity.
 * Historical DORA resolver output and free-text numbers never corroborate themselves. */
export function independentDoraClaims(data: Record<string, unknown>, sourceRef: string, scope: "person" | "shop"): DoraLicenseClaim[] {
  const sourceUrl = str(data.sourceUrl);
  if (/dora/i.test(sourceRef) || data.dora || data.matchedLicenseNumber || data.licenseStatusText) return [];
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password || /(^|\.)(colorado\.gov|state\.co\.us)$/.test(url.hostname) || /dora/i.test(str(data.sourceType) + str(data.sourceLabel))) return [];
  } catch { return []; }
  let source = data;
  if (!data.licenseNumber && !data.registrationNumber && str(data.rawBlock)) {
    try {
      const raw = obj(JSON.parse(str(data.rawBlock)));
      // Reject nested rosters or a raw source naming another person/business.
      if (normalizeDoraName(str(raw.displayName) || str(raw.name)) !== normalizeDoraName(str(data.displayName))) return [];
      if (raw.dora || raw.matchedLicenseNumber || /dora/i.test(str(raw.sourceType) + str(raw.sourceLabel))) return [];
      source = raw;
    } catch { return []; }
  }
  const value = str(scope === "shop" ? source.registrationNumber : source.licenseNumber);
  const full = /^([A-Z]{3,5})[. -]([0-9]{1,12})$/i.exec(value);
  const prefix = (full?.[1] || str(scope === "shop" ? source.registrationPrefix : source.licensePrefix) || str(source.licenseType)).toUpperCase();
  const number = normalizeDoraNumber(full?.[2] || value);
  if (!DORA_LICENSE_TYPES[prefix] || !number || (scope === "shop" ? prefix !== "REG" : prefix === "REG")) return [];
  return [{ prefix, number, sourceRef: `${sourceRef} (${sourceUrl})` }];
}
export function catalogDoraSubjects(row: CatalogRecord): { personLicense: DoraSubject; shopRegistration: DoraSubject } {
  const location = { city: row.city, state: row.state, postalCode: row.postalCode };
  return {
    personLicense: { scope: "person", name: row.entityType === "provider" ? row.providerName : "", ...location, licenseClaims: row.doraLicenseClaims?.personLicense || [] },
    shopRegistration: { scope: "shop", name: row.businessName, ...location, licenseClaims: row.doraLicenseClaims?.shopRegistration || [] },
  };
}
/** Pure exact-input fingerprint. A saved result is invalidated by changed source identity or review rejection. */
export function doraCatalogFingerprint(row: CatalogRecord): string {
  return JSON.stringify([catalogDoraSubjects(row), row.reviewDecisions.filter((decision) => decision.lane === "DORA").map((decision) => [decision.id, decision.status, decision.reviewedAt || ""])]);
}
export function legacyDoraCrossReference(results: Array<{ data: Record<string, unknown> }>): DoraCrossReference {
  const dora = emptyDoraCrossReference();
  for (const { data } of results) {
    if (data.dora && obj(data.dora).schemaVersion === 1) continue; // Modern results are projected through the durable exact-source head.
    const name = str(data.matchedLicenseName), number = str(data.matchedLicenseNumber), type = str(data.licenseType);
    if (!name && !number && !type && !str(data.licenseStatusText)) continue;
    const prefix = Object.keys(DORA_LICENSE_TYPES).find((prefix) => normalizeDoraName(type) === prefix || normalizeDoraName(type) === normalizeDoraName(DORA_LICENSE_TYPES[prefix])) || "";
    const check = prefix === "REG" ? dora.shopRegistration : dora.personLicense;
    check.status = "review"; check.outcome = "not_checked";
    check.reasons = ["Historical DORA claim; current official status and identity have not been corroborated."];
    if (data.finalStatus === "rejected") check.conflicts.push("Historical DORA match was rejected in manual review.");
    check.matches.push({ name, licenseType: type || "Unspecified license type", licensePrefix: prefix, licenseNumber: number, statusText: str(data.licenseStatusText), city: str(data.city), state: str(data.state), postalCode: str(data.postalCode), sourceUrl: officialDoraSourceUrl(data.sourceUrl), datasetUrl: DORA_DATASET_PAGE, identity: "review", basis: ["Retained historical source claim"], conflicts: [...check.conflicts], sourceRows: 1 });
  }
  return dora;
}
export function projectDoraCrossReference(row: CatalogRecord, records: DoraCrossReferenceRecord[], fallback = emptyDoraCrossReference()): DoraCrossReference {
  const record = records.filter((record) => record && record.schemaVersion === 1 && record.catalogId === row.id && record.fingerprint === doraCatalogFingerprint(row) && Number.isFinite(Date.parse(record.completedAt)))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  if (!record?.dora || record.dora.schemaVersion !== 1 || !record.dora.personLicense || !record.dora.shopRegistration) return fallback;
  const dora = structuredClone(record.dora), subjects = catalogDoraSubjects(row), now = Date.now();
  for (const key of ["personLicense", "shopRegistration"] as const) {
    const check = dora[key];
    if (!Array.isArray(check.matches) || !Array.isArray(check.reasons) || !Array.isArray(check.conflicts)
      || check.matches.some((match) => !match || typeof match !== "object" || !Array.isArray(match.basis) || !Array.isArray(match.conflicts))) return fallback;
    for (const match of check.matches) {
      match.sourceUrl = officialDoraSourceUrl(match.sourceUrl);
      match.datasetUrl = DORA_DATASET_PAGE;
    }
    if (["active", "expired"].includes(check.status)) {
      const checked = Date.parse(check.checkedAt || ""), next = Date.parse(record.nextAttemptAt);
      const match = check.matches[0];
      // Recompute the claim against the current independent identifiers. A saved label is not proof.
      const rows = check.matches.map((entry) => ({
        ...(key === "personLicense" ? { firstname: entry.name, lastname: "" } : { entityname: entry.name }),
        licensetype: entry.licensePrefix, licensenumber: str(entry.licenseNumber).split(/[. -]/).at(-1),
        licensestatusdescription: entry.statusText, city: entry.city, state: entry.state, mailzipcode: entry.postalCode,
        licenseexpirationdate: entry.expirationDate,
      }));
      const recomputed = matchDoraRecords(subjects[key], rows, { checkedAt: check.checkedAt || "", truncated: check.truncated });
      if (check.outcome !== "matched" || !Number.isFinite(checked) || checked > now + 60_000 || check.matches.length !== 1 || check.truncated
        || check.conflicts.length || match?.identity !== "corroborated" || match.conflicts.length || recomputed.status !== check.status) {
        check.status = "review"; check.reasons.push("Saved license status lacks current independent identity proof; review the official evidence.");
      } else if (!Number.isFinite(next) || next <= now || checked + 24 * 60 * 60_000 <= now) {
        check.status = "review"; check.reasons.push("Cached source check is stale; refresh before relying on the status.");
      }
    }
    if (row.reviewDecisions.some((decision) => decision.lane === "DORA" && decision.status === "rejected") && check.matches.length) {
      check.status = "review"; check.conflicts.push("DORA lane was rejected in manual review; refresh does not override that decision.");
    }
  }
  return dora;
}

/** Old resolver scores and active_match labels were never independently corroborated. */
export function safeDoraValidationStatus(result: { status: string; dora?: DoraCrossReference }, current?: DoraCrossReference): string {
  if (["active_match", "inactive_match"].includes(result.status)) {
    // Only the current catalog projection has checked the source fingerprint and independent claim.
    const check = current?.personLicense, now = Date.now();
    const expected = result.status === "active_match" ? "active" : "expired";
    if (!check || check.outcome !== "matched" || !check.checkedAt || check.status !== expected
      || !Array.isArray(check.matches) || check.matches.length !== 1 || check.truncated || check.conflicts.length
      || check.matches[0].identity !== "corroborated" || check.matches[0].conflicts.length
      || normalizeDoraName(check.matches[0].statusText) !== expected.toUpperCase()
      || !Number.isFinite(Date.parse(check.checkedAt)) || Date.parse(check.checkedAt) > now + 60_000
      || Date.parse(check.checkedAt) + 24 * 60 * 60_000 <= now) return "possible_match";
  }
  return result.status;
}
