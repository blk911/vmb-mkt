import crypto from "node:crypto";
import type { SourceRecord } from "@/lib/operators/types";
import { normalizeCity, normalizeName } from "@/lib/operators/normalize";
import type { ContainerRegistryEntry, ContainerStrategyName } from "./container-registry";

export type ContainerTenantCandidate = {
  name?: string;
  detailUrl?: string;
  category?: string;
  location?: string;
  city?: string;
};

export type ContainerExtractorResult = {
  parentContainerId: string;
  parentContainerName?: string;
  tenantCandidates: SourceRecord[];
  followOnDetailUrls: string[];
};

type AnchorRow = { url: string; text: string };

const STRATEGY_PATH_HINTS: Record<ContainerStrategyName, RegExp> = {
  sola: /(professional|profile|studios?|book|location|salon-professional|tenant|member)/i,
  phenix: /(professional|profile|suite|book|our-professionals|tenant|member)/i,
  mysalonsuite: /(member|profile|book|location|suite|find-a-member|professional)/i,
  solera: /(professional|profile|book|location|suite|tenant|member)/i,
  spectra: /(professional|profile|book|location|suite|tenant|member)/i,
};

const CATEGORY_HINT = /(nail|lash|brow|hair|spa|esthetic|barber|massage)/i;

function hashParentContainerId(seed: string): string {
  return crypto.createHash("md5").update(seed.toLowerCase()).digest("hex");
}

function parseParentContainerName(html: string, fallback?: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const raw = (headingMatch || titleMatch || fallback || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalizeName(raw);
  return normalized || undefined;
}

function extractAnchors(html: string, baseUrl: string): AnchorRow[] {
  const rows: AnchorRow[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = anchorRegex.exec(html))) {
    const href = (match[1] || "").trim();
    if (!href) continue;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const text = (match[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    rows.push({ url: absolute, text });
  }
  return rows;
}

function looksLikeTenantName(text: string): boolean {
  const cleaned = normalizeName(text);
  if (!cleaned) return false;
  if (cleaned.length < 3 || cleaned.length > 80) return false;
  if (!/[a-z]/i.test(cleaned)) return false;
  if (/(about|contact|privacy|terms|login|sign in|book now|view all|learn more|locations?)/i.test(cleaned)) return false;
  return true;
}

function inferCategory(text: string): string | undefined {
  const cleaned = text.toLowerCase();
  if (!CATEGORY_HINT.test(cleaned)) return undefined;
  if (cleaned.includes("nail")) return "nails";
  if (cleaned.includes("lash")) return "lashes";
  if (cleaned.includes("brow")) return "brows";
  if (cleaned.includes("hair") || cleaned.includes("barber")) return "hair";
  if (cleaned.includes("spa") || cleaned.includes("esthetic") || cleaned.includes("massage")) return "spa";
  return undefined;
}

function parseTenantCandidates(
  anchors: AnchorRow[],
  strategy: ContainerStrategyName,
  parentContainerName?: string
): ContainerTenantCandidate[] {
  const strategyPathHint = STRATEGY_PATH_HINTS[strategy];
  const rows: ContainerTenantCandidate[] = [];
  for (const anchor of anchors) {
    const urlLower = anchor.url.toLowerCase();
    const pathLooksUseful = strategyPathHint.test(urlLower);
    const nameLooksUseful = looksLikeTenantName(anchor.text);
    if (!pathLooksUseful && !nameLooksUseful) continue;
    rows.push({
      name: nameLooksUseful ? normalizeName(anchor.text) : undefined,
      detailUrl: anchor.url,
      category: inferCategory(anchor.text),
      location: parentContainerName,
      city: normalizeCity(anchor.text),
    });
  }
  return rows;
}

function dedupeTenants(tenants: ContainerTenantCandidate[]): ContainerTenantCandidate[] {
  const map = new Map<string, ContainerTenantCandidate>();
  for (const row of tenants) {
    const key = `${(normalizeName(row.name) || "").toLowerCase()}|${(row.detailUrl || "").toLowerCase()}`;
    if (!key || key === "|") continue;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

export function extractContainerTenants(input: {
  containerUrl: string;
  html: string;
  candidate: SourceRecord;
  registryEntry: ContainerRegistryEntry;
}): ContainerExtractorResult {
  const parentContainerName = parseParentContainerName(input.html, input.candidate.parentContainerName || input.candidate.name);
  const parentSeed = `${input.registryEntry.brand}|${input.containerUrl}|${parentContainerName || ""}`;
  const parentContainerId = hashParentContainerId(parentSeed);
  const anchors = extractAnchors(input.html, input.containerUrl);
  const parsedTenants = dedupeTenants(parseTenantCandidates(anchors, input.registryEntry.strategy, parentContainerName));

  const tenantCandidates: SourceRecord[] = parsedTenants.map((tenant) => ({
    source: "container",
    operatorType: "child_operator",
    parentContainerId,
    parentContainerName,
    name: tenant.name,
    city: tenant.city || normalizeCity(input.candidate.city),
    category: tenant.category,
    sourceUrl: tenant.detailUrl || input.containerUrl,
    extractedFromUrl: input.containerUrl,
    evidenceType: tenant.detailUrl ? "direct_operator" : "directory_listing",
    raw: {
      from: "container_extraction",
      containerBrand: input.registryEntry.brand,
      containerUrl: input.containerUrl,
    },
    extracted: {
      tenantName: tenant.name,
      tenantDetailUrl: tenant.detailUrl,
      strategy: input.registryEntry.strategy,
      parentContainerId,
      parentContainerName,
    },
  }));

  return {
    parentContainerId,
    parentContainerName,
    tenantCandidates,
    followOnDetailUrls: [...new Set(tenantCandidates.map((x) => x.sourceUrl).filter(Boolean) as string[])].slice(0, 50),
  };
}
