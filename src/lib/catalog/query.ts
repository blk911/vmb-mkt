import { safeProfileHref } from "@/lib/admin/pipeline/profile-presentation";
import type { CatalogFilters, CatalogRecord } from "./types";
const norm = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const any = (value: unknown) => !norm(value) || norm(value) === "all";
const keys = ["q", "platform", "entityType", "city", "postalCode", "area", "service", "reviewStatus", "hasBooking", "hasSocial", "sort", "direction"] as const;

export function normalizeCatalogFilters(value: unknown): CatalogFilters {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, string> = {};
  for (const key of keys) if (typeof input[key] === "string" && input[key].trim()) result[key] = input[key].trim().slice(0, 500);
  if (result.hasBooking && !["yes", "no", "all"].includes(result.hasBooking)) throw new Error("invalid_booking_filter");
  if (result.hasSocial && !["yes", "no", "all"].includes(result.hasSocial)) throw new Error("invalid_social_filter");
  if (result.direction && !["asc", "desc"].includes(result.direction)) throw new Error("invalid_sort_direction");
  return result as CatalogFilters;
}

export function filterCatalogRecords(rows: CatalogRecord[], filters: CatalogFilters = {}): CatalogRecord[] {
  const q = norm(filters.q);
  return rows.filter((row) => {
    const links = row.profile ? [...row.profile.bookingLinks, ...row.profile.socialLinks, ...row.profile.websiteLinks] : [];
    const haystack = [row.id, row.displayName, row.providerName, row.businessName, row.platformLabel, row.city, row.state, row.postalCode, row.area, row.reviewStatus, ...row.services, ...links.map((link) => link.url)].join(" ").toLowerCase();
    if (q && !q.split(/\s+/).every((term) => haystack.includes(term))) return false;
    if (!any(filters.platform) && ![...(row.profile?.knownPlatforms || []), ...(row.profile?.knownPlatforms?.length ? [] : [row.profile?.platform]), row.platformLabel].some((value) => norm(value) === norm(filters.platform))) return false;
    if (!any(filters.entityType) && norm(row.entityType) !== norm(filters.entityType)) return false;
    if (!any(filters.city) && norm(row.city) !== norm(filters.city)) return false;
    if (!any(filters.postalCode) && norm(row.postalCode) !== norm(filters.postalCode)) return false;
    if (!any(filters.area) && !norm(row.area).includes(norm(filters.area))) return false;
    if (!any(filters.service) && !row.services.some((service) => norm(service).includes(norm(filters.service)))) return false;
    if (!any(filters.reviewStatus) && norm(row.reviewStatus) !== norm(filters.reviewStatus)) return false;
    const hasBooking = !!row.profile?.bookingLinks.some((link) => link.attribution !== "unresolved" && link.kind !== "directory" && !!safeProfileHref(link.url));
    const hasSocial = !!row.profile?.socialLinks.some((link) => link.attribution !== "unresolved" && !!safeProfileHref(link.url));
    if (filters.hasBooking === "yes" && !hasBooking || filters.hasBooking === "no" && hasBooking) return false;
    if (filters.hasSocial === "yes" && !hasSocial || filters.hasSocial === "no" && hasSocial) return false;
    return true;
  });
}

export function sortCatalogRecords(rows: CatalogRecord[], sortOrFilters: string | CatalogFilters = "platform", direction?: "asc" | "desc"): CatalogRecord[] {
  const sort = typeof sortOrFilters === "string" ? sortOrFilters : sortOrFilters.sort || "platform";
  const order = (direction || (typeof sortOrFilters === "object" ? sortOrFilters.direction : undefined)) === "desc" ? -1 : 1;
  const value = (row: CatalogRecord) => {
    switch (sort) {
      case "platform": case "platformLabel": return row.platformLabel;
      case "provider": case "providerName": return row.providerName;
      case "salon": case "businessName": return row.businessName;
      case "service": case "services": return row.services.join(", ");
      case "city": return `${row.city} ${row.postalCode}`;
      case "postalCode": return row.postalCode;
      case "status": case "reviewStatus": return row.reviewStatus;
      case "area": return row.area;
      case "booking": return row.profile?.bookingLinks.find((link) => link.attribution !== "unresolved" && link.kind !== "directory" && safeProfileHref(link.url))?.url || "";
      case "social": return row.profile?.socialLinks.find((link) => link.attribution !== "unresolved" && safeProfileHref(link.url))?.url || "";
      case "updatedAt": return row.updatedAt;
      case "entityType": return row.entityType;
      default: return row.displayName;
    }
  };
  return [...rows].sort((a, b) => order * value(a).localeCompare(value(b), undefined, { numeric: true }) || a.id.localeCompare(b.id));
}
