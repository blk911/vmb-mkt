import { CATALOG_FILTER_KEYS, catalogNeedsReview, filterCatalogRecords, normalizeCatalogFilters, sortCatalogRecords } from "@/lib/catalog/query";
import type { CatalogFilters, CatalogRecord } from "@/lib/catalog/types";
import type { TargetList } from "./types";

const FILTER_KEYS = new Set<string>(CATALOG_FILTER_KEYS);

/** Reject unsupported dynamic predicates instead of silently broadening membership. */
export function validateDynamicFilters(value: unknown): CatalogFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Filters must be an object.");
  for (const [key, entry] of Object.entries(value)) {
    if (!FILTER_KEYS.has(key) || typeof entry !== "string" || entry.length > 500) throw new Error(`Unsupported dynamic filter: ${key}.`);
  }
  return normalizeCatalogFilters(value);
}

export function resolveTargetListMembership(list: TargetList, rows: CatalogRecord[]) {
  if (list.membershipMode === "dynamic") {
    const filters = validateDynamicFilters(list.savedQuery || {});
    const matched = sortCatalogRecords(filterCatalogRecords(rows, filters), filters);
    return { rows: matched, catalogIds: matched.map((row) => row.id), missingIds: [] as string[], unresolvedLegacyItems: [] as TargetList["items"] };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    rows: list.catalogIds.map((id) => byId.get(id)).filter((row): row is CatalogRecord => !!row),
    catalogIds: list.catalogIds,
    missingIds: list.catalogIds.filter((id) => !byId.has(id)),
    unresolvedLegacyItems: list.items.filter((item) => !item.catalogId),
  };
}

/** Defend spreadsheet exports against formulas, including leading whitespace/control characters. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function targetListCatalogCsv(list: TargetList, rows: CatalogRecord[], generatedAt: string) {
  const membership = resolveTargetListMembership(list, rows);
  const byId = new Map(membership.rows.map((row) => [row.id, row]));
  const header = ["listId", "listName", "membershipMode", "catalogId", "resolutionStatus", "entityType", "displayName", "providerName", "businessName", "platform", "market", "marketId", "vertical", "verticals", "mappingProvenance", "needsReview", "reviewLanes", "city", "state", "postalCode", "area", "services", "reviewStatus", "phone", "bookingLinks", "socialLinks", "websiteLinks", "knownPlatforms", "unresolvedDiscoveries", "linkEvidence", "factClaims", "sourceRefs", "reviewDecisions", "conflicts", "owner", "nextAction", "nextActionAt", "notes", "generatedAt"];
  const lines = [header.map(csvCell).join(",")];
  function line(id: string, row: CatalogRecord | undefined, status: string, fallbackName = "") {
    return [
      list.id, list.name, list.membershipMode, id, status,
      row?.entityType, row?.displayName || fallbackName, row?.providerName, row?.businessName, row?.platformLabel,
      row ? row.market || "Unknown" : "", row?.marketId, row ? row.vertical || "Unknown" : "", row?.verticals?.join(" | "), row ? JSON.stringify(row.mapping || {}) : "", row ? catalogNeedsReview(row) : "", row ? JSON.stringify(row.reviewLanes || []) : "",
      row?.city, row?.state, row?.postalCode, row?.area, row?.services.join(" | "), row?.reviewStatus, row?.phone,
      row?.profile?.bookingLinks.filter((link) => link.attribution !== "unresolved" && link.kind !== "directory").map((link) => link.url).join(" | "),
      row?.profile?.socialLinks.filter((link) => link.attribution !== "unresolved").map((link) => link.url).join(" | "),
      row?.profile?.websiteLinks.filter((link) => link.attribution !== "unresolved").map((link) => link.url).join(" | "),
      row?.profile?.knownPlatforms?.join(" | "),
      row?.profile ? [...row.profile.bookingLinks, ...row.profile.socialLinks, ...row.profile.websiteLinks].filter((link) => link.attribution === "unresolved").map((link) => link.url).join(" | ") : "",
      row?.profile ? JSON.stringify([...row.profile.bookingLinks, ...row.profile.socialLinks, ...row.profile.websiteLinks]) : "",
      row ? JSON.stringify(row.factClaims || []) : "", row ? JSON.stringify(row.sourceRefs) : "", row ? JSON.stringify(row.reviewDecisions) : "", row?.conflicts.join(" | "),
      list.workflow?.owner, list.workflow?.nextAction, list.workflow?.nextActionAt, list.notes, generatedAt,
    ].map(csvCell).join(",");
  }
  for (const id of membership.catalogIds) {
    const row = byId.get(id);
    lines.push(line(id, row, row ? "resolved" : "catalog_record_unavailable", list.items.find((item) => item.catalogId === id)?.label || ""));
  }
  for (const item of membership.unresolvedLegacyItems) {
    lines.push(line(`legacy:${item.kind}:${item.refId}`, undefined, "unresolved_legacy_reference", item.label));
  }
  return { csv: lines.join("\r\n"), membership };
}
