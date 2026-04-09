import { classifyPage } from "./page-classifier";
import { normalizeCity, normalizeName } from "./normalize";
import { deepExtractFromSolaChildPage, isSolaChildDetailUrl } from "@/lib/containers/sola-deep-extract";
import { parseBooksy } from "./domain-parsers/booksy";
import { parseFresha } from "./domain-parsers/fresha";
import { parseSola } from "./domain-parsers/sola";
import {
  asString,
  composeAddress,
  extractCityFromAddress,
  extractJsonLdObjects,
  extractLinks,
  stripHtml,
  extractMetaContent,
  extractTitle,
  getFirstMatch,
} from "./domain-parsers/shared";
import { parseVagaro } from "./domain-parsers/vagaro";
import type { PageClassification, SourceRecord } from "./types";
import type { DomainParserOutput } from "./domain-parsers/shared";

export type ExtractedPageFields = {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  booking?: string;
  category?: string;
  parentContainerName?: string;
  evidenceType: PageClassification;
  childQuerySeeds?: string[];
  parserUsed?: string;
  internalDetailLinks?: string[];
};

const BOOKING_HOST_HINTS = ["glossgenius.com", "vagaro.com", "styleseat.com", "booksy.com", "fresha.com", "square.site"];
const SOCIAL_HOST_HINTS = ["instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com"];
const DIRECTORY_HOST_HINTS = ["yelp.com", "yellowpages.com", "foursquare.com", "mapquest.com", "google.com"];
const DETAIL_PATH_HINT = /(profile|provider|professional|staff|artist|detail|book|booking|service|team|tenant|member|technician)/i;
const EXCLUDE_PATH_HINT = /(login|signup|register|privacy|terms|help|contact|about|careers)/i;
const CATEGORY_HINTS: Array<{ category: string; pattern: RegExp }> = [
  { category: "nails", pattern: /\bnail|manicure|pedicure|gel[-\s]?x\b/i },
  { category: "lashes", pattern: /\blash|extensions?\b/i },
  { category: "brows", pattern: /\bbrow|microblade|microblading\b/i },
  { category: "hair", pattern: /\bhair|barber|colorist|stylist\b/i },
  { category: "spa", pattern: /\bspa|facial|esthetic|massage\b/i },
];

function firstWebsite(urls: string[]): string | undefined {
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (!SOCIAL_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`)) &&
          !BOOKING_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`)) &&
          !DIRECTORY_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`))) {
        return value;
      }
    } catch {
      // ignored
    }
  }
  return undefined;
}

function hostMatches(host: string, hints: string[]): boolean {
  return hints.some((hint) => host === hint || host.endsWith(`.${hint}`));
}

function canonicalLinkUrl(html: string, origin: string): string | undefined {
  const raw = getFirstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["'][^>]*>/i);
  if (!raw) return undefined;
  try {
    return new URL(raw, origin).toString();
  } catch {
    return undefined;
  }
}

function normalizeComparableUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.hostname.includes("instagram.com")) {
      parsed.search = "";
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments[0]) parsed.pathname = `/${segments[0].replace(/^@/, "")}/`;
      return parsed.toString();
    }
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return value.trim();
  }
}

function scoreSurfaceLink(
  value: string,
  origin: string,
  kind: "booking" | "instagram" | "website"
): number {
  try {
    const parsed = new URL(value);
    const originHost = new URL(origin).hostname.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    let score = 0;

    if (EXCLUDE_PATH_HINT.test(path)) score -= 40;

    if (kind === "booking") {
      if (hostMatches(host, BOOKING_HOST_HINTS)) score += 40;
      if (/(book|booking|reserve|appointment|schedule)/i.test(path)) score += 18;
      if (DETAIL_PATH_HINT.test(path)) score += 8;
    } else if (kind === "instagram") {
      if (host.includes("instagram.com")) score += 40;
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length === 1) score += 18;
      if (/^(p|reel|reels|stories|explore|accounts|tv)$/i.test(segments[0] || "")) score -= 35;
      if (parsed.search.includes("utm_")) score -= 2;
    } else {
      if (hostMatches(host, DIRECTORY_HOST_HINTS)) return -25;
      if (!hostMatches(host, SOCIAL_HOST_HINTS) && !hostMatches(host, BOOKING_HOST_HINTS) && !hostMatches(host, DIRECTORY_HOST_HINTS)) {
        score += 28;
      }
      if (host !== originHost) score += 12;
      if (parsed.pathname === "/" || parsed.pathname === "") score += 8;
      if (/^(\/(home|about|services?)\/?)?$/i.test(parsed.pathname)) score += 4;
    }

    return score;
  } catch {
    return -100;
  }
}

function pickBestSurfaceLink(
  urls: string[],
  origin: string,
  kind: "booking" | "instagram" | "website"
): string | undefined {
  const deduped = [...new Set(urls.map(normalizeComparableUrl))];
  const ranked = deduped
    .map((value) => ({ value, score: scoreSurfaceLink(value, origin, kind) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.value;
}

function getParser(url: string): { name: string; run: (url: string, html: string, preliminaryName?: string, preliminaryCity?: string) => DomainParserOutput } | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("booksy.com")) return { name: "booksy", run: parseBooksy };
    if (host.includes("solasalonstudios.com")) return { name: "sola", run: parseSola };
    if (host.includes("vagaro.com")) return { name: "vagaro", run: parseVagaro };
    if (host.includes("fresha.com")) return { name: "fresha", run: parseFresha };
  } catch {
    // ignore invalid urls
  }
  return undefined;
}

function extractInternalDetailLinks(html: string, origin: string, parserOutput?: DomainParserOutput): string[] {
  const rows: string[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;
  const originHost = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  while ((match = anchorRegex.exec(html))) {
    const href = match[1]?.trim();
    if (!href) continue;
    let resolved: string;
    try {
      resolved = new URL(href, origin).toString();
    } catch {
      continue;
    }
    const text = match[2]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase() || "";
    let path = "";
    let host = "";
    try {
      const parsed = new URL(resolved);
      host = parsed.hostname.toLowerCase();
      path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    } catch {
      continue;
    }
    const likelyInternal = host === originHost || host.endsWith(`.${originHost}`);
    const likelyDetail = DETAIL_PATH_HINT.test(path) || DETAIL_PATH_HINT.test(text);
    if (!likelyInternal || !likelyDetail || EXCLUDE_PATH_HINT.test(path)) continue;
    rows.push(resolved);
  }

  const parserHints = [parserOutput?.booking, parserOutput?.website].filter(Boolean) as string[];
  for (const hint of parserHints) {
    if (!hint) continue;
    try {
      const parsed = new URL(hint);
      if (DETAIL_PATH_HINT.test(`${parsed.pathname}${parsed.search}`.toLowerCase())) rows.push(parsed.toString());
    } catch {
      // ignore
    }
  }

  return [...new Set(rows)].slice(0, 20);
}

function extractHeadingName(html: string): string | undefined {
  const h1 = getFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return normalizeName(h1.replace(/<[^>]+>/g, " ").trim());
  const h2 = getFirstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) return normalizeName(h2.replace(/<[^>]+>/g, " ").trim());
  const itemprop = getFirstMatch(html, /itemprop=["']name["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (itemprop) return normalizeName(itemprop.replace(/<[^>]+>/g, " ").trim());
  return undefined;
}

function extractContactHref(links: string[], protocol: "mailto:" | "tel:"): string | undefined {
  const hit = links.find((value) => value.toLowerCase().startsWith(protocol));
  if (!hit) return undefined;
  if (protocol === "mailto:") return undefined;
  return hit.replace(/^tel:/i, "").trim() || undefined;
}

function inferCategoryHint(html: string, title?: string, heading?: string): string | undefined {
  const text = [title || "", heading || "", html.slice(0, 30000)].join(" ");
  for (const row of CATEGORY_HINTS) {
    if (row.pattern.test(text)) return row.category;
  }
  return undefined;
}

export function extractFromPage(url: string, html: string, preliminary: SourceRecord): ExtractedPageFields {
  const evidenceType = classifyPage(url, html);
  const looksDetailPage = DETAIL_PATH_HINT.test(url);
  const parser = getParser(url);
  const parserOutput = parser?.run(url, html, preliminary.name, preliminary.city);
  const title = extractTitle(html);
  const headingName = extractHeadingName(html);
  const ogTitle = extractMetaContent(html, "og:title");
  const siteName = extractMetaContent(html, "og:site_name");
  const phoneFromMeta = extractMetaContent(html, "telephone");
  const links = extractLinks(html, url);
  const canonicalUrl = canonicalLinkUrl(html, url);
  const jsonLd = extractJsonLdObjects(html);

  let jsonName: string | undefined;
  let jsonPhone: string | undefined;
  let jsonWebsite: string | undefined;
  let jsonAddress: string | undefined;
  let jsonCity: string | undefined;

  for (const item of jsonLd) {
    jsonName ||= normalizeName(asString(item.name));
    jsonPhone ||= asString(item.telephone);
    jsonWebsite ||= asString(item.url);
    const rawAddress = item.address;
    if (rawAddress && typeof rawAddress === "object") {
      const street = asString((rawAddress as Record<string, unknown>).streetAddress);
      const city = asString((rawAddress as Record<string, unknown>).addressLocality);
      const region = asString((rawAddress as Record<string, unknown>).addressRegion);
      jsonAddress ||= composeAddress(street, city, region);
      jsonCity ||= normalizeCity(city);
    } else if (typeof rawAddress === "string") {
      jsonAddress ||= rawAddress.trim();
    }
  }

  const instagram = pickBestSurfaceLink(links, url, "instagram");
  const booking = pickBestSurfaceLink(links, url, "booking");
  const website =
    pickBestSurfaceLink(
      [canonicalUrl, jsonWebsite, ...links].filter((value): value is string => Boolean(value)),
      url,
      "website"
    ) || firstWebsite(links) || jsonWebsite;
  const address = jsonAddress;
  const city = jsonCity || extractCityFromAddress(address) || normalizeCity(preliminary.city);
  const phone = jsonPhone || phoneFromMeta || getFirstMatch(html, /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phoneFromHref = extractContactHref(links, "tel:");
  const phoneFromBodyMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phoneFromBody = phoneFromBodyMatch?.[1]?.trim();
  const parentContainerName =
    siteName && /suite|studios/i.test(siteName)
      ? normalizeName(siteName)
      : title && /suite|studios/i.test(title)
        ? normalizeName(title)
        : undefined;
  const internalDetailLinks = extractInternalDetailLinks(html, url, parserOutput);
  const categoryHint = inferCategoryHint(html, title, headingName);
  const deepSola = isSolaChildDetailUrl(url) ? deepExtractFromSolaChildPage({ url, html }) : undefined;

  const resolvedName = looksDetailPage
    ? headingName || jsonName || normalizeName(ogTitle) || parserOutput?.name || title || normalizeName(preliminary.name)
    : parserOutput?.name || jsonName || normalizeName(ogTitle) || title || normalizeName(preliminary.name);
  const strippedTitle = title ? stripHtml(title) : undefined;
  const derivedEvidenceType =
    (booking || instagram || website) && (looksDetailPage || parserOutput?.evidenceType === "direct_operator")
      ? "direct_operator"
      : parserOutput?.evidenceType || evidenceType;

  return {
    evidenceType: derivedEvidenceType,
    parserUsed: deepSola?.extractionSignals?.length ? "sola-deep" : parser?.name,
    name: deepSola?.name || resolvedName || strippedTitle,
    address: parserOutput?.address || address || preliminary.address,
    city: parserOutput?.city || city || normalizeCity(preliminary.city),
    phone: deepSola?.phone || phone || phoneFromHref || phoneFromBody || preliminary.phone,
    email: deepSola?.email,
    website: deepSola?.website || parserOutput?.website || website || preliminary.website,
    instagram: deepSola?.instagram || parserOutput?.instagram || instagram || preliminary.instagram,
    booking: deepSola?.booking || parserOutput?.booking || booking || preliminary.booking,
    category: deepSola?.category || categoryHint || preliminary.category,
    parentContainerName: deepSola?.parentContainerName || parserOutput?.parentContainerName || parentContainerName || preliminary.parentContainerName,
    childQuerySeeds: parserOutput?.childQuerySeeds,
    internalDetailLinks: deepSola?.internalDetailLinks?.length ? deepSola.internalDetailLinks : internalDetailLinks,
  };
}

