import { classifyPage } from "./page-classifier";
import { normalizeCity, normalizeName } from "./normalize";
import type { PageClassification, SourceRecord } from "./types";

export type ExtractedPageFields = {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  booking?: string;
  parentContainerName?: string;
  evidenceType: PageClassification;
};

const BOOKING_HOST_HINTS = ["glossgenius.com", "vagaro.com", "styleseat.com", "booksy.com", "fresha.com", "square.site"];
const SOCIAL_HOST_HINTS = ["instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com"];

function getFirstMatch(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | undefined {
  const raw = getFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!raw) return undefined;
  return normalizeName(stripHtml(raw));
}

function extractMetaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  return getFirstMatch(html, regex)?.trim();
}

function extractLinks(html: string): string[] {
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html))) {
    const href = match[1]?.trim();
    if (href) links.push(href);
  }
  return links;
}

function normalizeUrl(href: string, origin: string): string | undefined {
  try {
    return new URL(href, origin).toString();
  } catch {
    return undefined;
  }
}

function firstByHost(urls: string[], hostHints: string[]): string | undefined {
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (hostHints.some((hint) => host === hint || host.endsWith(`.${hint}`))) return value;
    } catch {
      // ignored
    }
  }
  return undefined;
}

function firstWebsite(urls: string[]): string | undefined {
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (!SOCIAL_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`)) &&
          !BOOKING_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`))) {
        return value;
      }
    } catch {
      // ignored
    }
  }
  return undefined;
}

function extractJsonLdObjects(html: string): Record<string, unknown>[] {
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
        continue;
      }
      if (parsed && typeof parsed === "object") objects.push(parsed as Record<string, unknown>);
    } catch {
      // ignored
    }
  }
  return objects;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractCityFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return normalizeCity(parts[1]);
  return undefined;
}

export function extractFromPage(url: string, html: string, preliminary: SourceRecord): ExtractedPageFields {
  const evidenceType = classifyPage(url, html);
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "og:title");
  const siteName = extractMetaContent(html, "og:site_name");
  const phoneFromMeta = extractMetaContent(html, "telephone");
  const links = extractLinks(html)
    .map((href) => normalizeUrl(href, url))
    .filter((value): value is string => Boolean(value));
  const jsonLd = extractJsonLdObjects(html);

  let jsonName: string | undefined;
  let jsonPhone: string | undefined;
  let jsonWebsite: string | undefined;
  let jsonAddress: string | undefined;
  let jsonCity: string | undefined;

  for (const item of jsonLd) {
    jsonName ||= normalizeName(getStringValue(item.name));
    jsonPhone ||= getStringValue(item.telephone);
    jsonWebsite ||= getStringValue(item.url);
    const rawAddress = item.address;
    if (rawAddress && typeof rawAddress === "object") {
      const street = getStringValue((rawAddress as Record<string, unknown>).streetAddress);
      const city = getStringValue((rawAddress as Record<string, unknown>).addressLocality);
      const region = getStringValue((rawAddress as Record<string, unknown>).addressRegion);
      jsonAddress ||= [street, city, region].filter(Boolean).join(", ") || undefined;
      jsonCity ||= normalizeCity(city);
    } else if (typeof rawAddress === "string") {
      jsonAddress ||= rawAddress.trim();
    }
  }

  const instagram = firstByHost(links, ["instagram.com"]);
  const booking = firstByHost(links, BOOKING_HOST_HINTS);
  const website = firstWebsite(links) || jsonWebsite;
  const address = jsonAddress;
  const city = jsonCity || extractCityFromAddress(address) || normalizeCity(preliminary.city);
  const phone = jsonPhone || phoneFromMeta || getFirstMatch(html, /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phoneFromBodyMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phoneFromBody = phoneFromBodyMatch?.[1]?.trim();
  const parentContainerName =
    siteName && /suite|studios/i.test(siteName)
      ? normalizeName(siteName)
      : title && /suite|studios/i.test(title)
        ? normalizeName(title)
        : undefined;

  return {
    evidenceType,
    name: jsonName || normalizeName(ogTitle) || title || normalizeName(preliminary.name),
    address: address || preliminary.address,
    city: city || normalizeCity(preliminary.city),
    phone: phone || phoneFromBody || preliminary.phone,
    website: website || preliminary.website,
    instagram: instagram || preliminary.instagram,
    booking: booking || preliminary.booking,
    parentContainerName: parentContainerName || preliminary.parentContainerName,
  };
}

