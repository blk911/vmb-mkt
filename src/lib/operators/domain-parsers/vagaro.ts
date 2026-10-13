import { normalizeCity, normalizeName } from "../normalize";
import type { DomainParserOutput } from "./shared";
import {
  asString,
  composeAddress,
  extractCityFromAddress,
  extractJsonLdObjects,
  extractLinks,
  extractMetaContent,
  extractTitle,
  firstByHost,
  stripHtml,
} from "./shared";

function listingLike(url: string, html: string): boolean {
  const u = url.toLowerCase();
  const h = html.toLowerCase();
  return /\/(listing|listings|search|directory|marketplace|professionals)\b/.test(u) || h.includes("find a salon");
}

export type VagaroDirectoryListing = {
  displayName: string;
  businessName?: string;
  city?: string;
  state?: string;
  location?: string;
  serviceHint?: string;
  profileUrl?: string;
  sourceScopedIds?: Array<{ sourceUrl: string; id: string }>;
  ratingSummary?: string;
  sourceNote: "vagaro_directory_results";
  pageClassification: "directory_results_page";
};

function parseServiceHint(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    if (segments[0]?.toLowerCase() !== "professionals" || !segments[1]) return undefined;
    return segments[1]
      .replace(/[-_]+/g, " ")
      .trim()
      .toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

function parseLocation(value?: string): { city?: string; state?: string; location?: string } {
  const location = stripHtml(value || "");
  if (!location) return {};
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || undefined,
    state: parts[1] || undefined,
    location,
  };
}

function extractAnchorField(block: string, regex: RegExp): string | undefined {
  const match = block.match(regex);
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

function htmlAttribute(attributes: string, name: string): string | undefined {
  const value = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
  return value?.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}

export function extractVagaroDirectoryListings(url: string, html: string): VagaroDirectoryListing[] {
  if (!firstByHost([url], ["vagaro.com"]) || !listingLike(url, html)) return [];
  const serviceHint = parseServiceHint(url);
  const anchorRegex = /<a\b([^>]*)>[\s\S]*?<\/a>/gi;
  const listings: VagaroDirectoryListing[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = anchorRegex.exec(html))) {
    const anchorId = htmlAttribute(match[1] || "", "id");
    if (!anchorId?.startsWith("lnkServiceProvider_")) continue;
    const href = htmlAttribute(match[1] || "", "href")?.trim();
    const block = match[0] || "";
    const displayName =
      extractAnchorField(block, /<div\b[^>]*\sid=["']spnProviderName_[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      stripHtml(htmlAttribute(match[1] || "", "aria-label") || "");
    if (!displayName) continue;
    const businessName = extractAnchorField(block, /<div\b[^>]*\sid=["']spnBusinessName_[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const ratingSummary = extractAnchorField(block, /<div[^>]+class="card-review-number[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const locationText = extractAnchorField(block, /<div\b[^>]*\sclass=["'][^"']*\btext-block-6\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const location = parseLocation(locationText);
    let profileUrl: string | undefined;
    if (href) {
      try {
        profileUrl = new URL(href, url).toString();
      } catch {
        profileUrl = undefined;
      }
    }
    listings.push({
      displayName: normalizeName(displayName) || displayName,
      businessName: normalizeName(businessName),
      city: location.city,
      state: location.state,
      location: location.location,
      serviceHint,
      profileUrl,
      sourceScopedIds: [...new Set(Array.from(block.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi), (entry) => entry[1]))]
        .map((id) => ({ sourceUrl: url, id })),
      ratingSummary,
      sourceNote: "vagaro_directory_results",
      pageClassification: "directory_results_page",
    });
  }
  return listings;
}

export function parseVagaro(url: string, html: string, preliminaryName?: string, preliminaryCity?: string): DomainParserOutput {
  const title = extractTitle(html);
  const metaTitle = normalizeName(extractMetaContent(html, "og:title"));
  const links = extractLinks(html, url);
  const jsonLd = extractJsonLdObjects(html);

  let address: string | undefined;
  let city: string | undefined;
  for (const item of jsonLd) {
    const rawAddress = item.address;
    if (rawAddress && typeof rawAddress === "object") {
      const street = asString((rawAddress as Record<string, unknown>).streetAddress);
      const locality = asString((rawAddress as Record<string, unknown>).addressLocality);
      const region = asString((rawAddress as Record<string, unknown>).addressRegion);
      address ||= composeAddress(street, locality, region);
      city ||= normalizeCity(locality);
    }
  }

  return {
    name: metaTitle || title || normalizeName(preliminaryName),
    address,
    city: city || extractCityFromAddress(address) || normalizeCity(preliminaryCity),
    instagram: firstByHost(links, ["instagram.com"]),
    booking: firstByHost([url, ...links], ["vagaro.com"]),
    website: firstByHost([url, ...links], ["vagaro.com"]) ? undefined : url,
    evidenceType: listingLike(url, html) ? "directory_listing" : "direct_operator",
  };
}

