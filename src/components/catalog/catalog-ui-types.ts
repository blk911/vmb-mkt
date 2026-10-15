import type { TargetWorkflow } from "@/lib/ops/targetWorkflow";
export type { CatalogRecord } from "@/lib/catalog/types";
export type CatalogFilters = {
  q: string;
  market: string;
  vertical: string;
  needsReview: "yes" | "no" | "all";
  platform: string;
  entityType: string;
  service: string;
  area: string;
  city: string;
  postalCode: string;
  reviewStatus: string;
  hasBooking: "yes" | "no" | "all";
  hasSocial: "yes" | "no" | "all";
};

export const EMPTY_FILTERS: CatalogFilters = {
  q: "", market: "", vertical: "", needsReview: "all", platform: "", entityType: "", service: "", area: "", city: "", postalCode: "", reviewStatus: "", hasBooking: "all", hasSocial: "all",
};

export type CatalogList = {
  id: string;
  name: string;
  membershipMode: "fixed" | "dynamic";
  techIds: string[];
  catalogIds?: string[];
  unresolvedLegacyItems?: Array<{ kind: string; refId: string; label?: string }>;
  filters?: Partial<CatalogFilters>;
  notes?: string;
  workflow?: Partial<TargetWorkflow> & { nextAction?: string };
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
};

export function listMemberIds(list: CatalogList) {
  return list.catalogIds ?? list.techIds;
}

export function readable(value?: string) {
  return value ? value.replaceAll("_", " ") : "Unknown";
}

export function dateLabel(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.ok === false) {
    throw new Error(result?.message ? String(result.message) : result?.error ? readable(String(result.error)) : `Request failed (${response.status}). Please retry.`);
  }
  return result as T;
}

export function postList(body: Record<string, unknown>) {
  return readJson<{ ok: true; list?: CatalogList; archived?: string; recoverable?: boolean }>("/api/targets/lists", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
