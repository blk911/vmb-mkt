import { normalizeCity, normalizeName } from "../normalize";
import type { PageClassification } from "../types";

export type DomainParserOutput = {
  name?: string;
  address?: string;
  city?: string;
  instagram?: string;
  booking?: string;
  website?: string;
  parentContainerName?: string;
  evidenceType: PageClassification;
  childQuerySeeds?: string[];
};

export type DomainParser = (url: string, html: string, preliminaryName?: string, preliminaryCity?: string) => DomainParserOutput;

export function getFirstMatch(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTitle(html: string): string | undefined {
  const raw = getFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!raw) return undefined;
  return normalizeName(stripHtml(raw));
}

export function extractMetaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  return getFirstMatch(html, regex)?.trim();
}

export function extractLinks(html: string, origin: string): string[] {
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html))) {
    const href = match[1]?.trim();
    if (!href) continue;
    try {
      links.push(new URL(href, origin).toString());
    } catch {
      // ignore malformed href
    }
  }
  return links;
}

export function extractJsonLdObjects(html: string): Record<string, unknown>[] {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const objects: Record<string, unknown>[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html))) {
    const payload = match[1]?.trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") objects.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore bad json-ld blocks
    }
  }
  return objects;
}

export function firstByHost(urls: string[], hostHints: string[]): string | undefined {
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (hostHints.some((hint) => host === hint || host.endsWith(`.${hint}`))) return value;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function extractCityFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  return normalizeCity(parts[1]);
}

export function normalizeDomainValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function composeAddress(street?: string, city?: string, region?: string): string | undefined {
  const built = [street, city, region].filter(Boolean).join(", ");
  return built || undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

