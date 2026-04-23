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
    city: normalizeCity(parts[0]),
    state: parts[1] || undefined,
    location,
  };
}

function extractAnchorField(block: string, regex: RegExp): string | undefined {
  const match = block.match(regex);
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

export function extractVagaroDirectoryListings(url: string, html: string): VagaroDirectoryListing[] {
  if (!listingLike(url, html)) return [];
  const serviceHint = parseServiceHint(url);
  const anchorRegex = /<a class="text-decoration-none normalcolor" href="([^"]+)" id="lnkServiceProvider_[^"]*"[\s\S]*?aria-label="([^"]*)"[\s\S]*?<\/a>/gi;
  const listings: VagaroDirectoryListing[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = anchorRegex.exec(html))) {
    const href = match[1]?.trim();
    const block = match[0] || "";
    const displayName =
      extractAnchorField(block, /<div id="spnProviderName_[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      stripHtml(match[2] || "");
    if (!displayName) continue;
    const businessName = extractAnchorField(block, /<div[^>]+id="spnBusinessName_[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const ratingSummary = extractAnchorField(block, /<div[^>]+class="card-review-number[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const locationText = extractAnchorField(block, /<div class="text-block-6 web-body-font"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
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
    booking: url.includes("vagaro.com") ? url : firstByHost(links, ["vagaro.com"]),
    website: firstByHost(links, ["vagaro.com"]) ? undefined : url,
    evidenceType: listingLike(url, html) ? "directory_listing" : "direct_operator",
  };
}

