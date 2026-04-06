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
  getFirstMatch,
} from "./shared";

function looksLikeListing(url: string, html: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerHtml = html.toLowerCase();
  if (/\/(search|listing|listings|category|categories|marketplace)\b/.test(lowerUrl)) return true;
  if (lowerHtml.includes("find professionals") || lowerHtml.includes("search results")) return true;
  if ((lowerHtml.match(/booksy\./g) || []).length > 6) return true;
  return false;
}

function extractFromJsonLd(html: string): { name?: string; address?: string; city?: string; website?: string } {
  const objects = extractJsonLdObjects(html);
  let name: string | undefined;
  let address: string | undefined;
  let city: string | undefined;
  let website: string | undefined;
  for (const item of objects) {
    name ||= normalizeName(asString(item.name));
    website ||= asString(item.url);
    const rawAddress = item.address;
    if (rawAddress && typeof rawAddress === "object") {
      const street = asString((rawAddress as Record<string, unknown>).streetAddress);
      const locality = asString((rawAddress as Record<string, unknown>).addressLocality);
      const region = asString((rawAddress as Record<string, unknown>).addressRegion);
      address ||= composeAddress(street, locality, region);
      city ||= normalizeCity(locality);
    }
  }
  return { name, address, city, website };
}

export function parseBooksy(url: string, html: string, preliminaryName?: string, preliminaryCity?: string): DomainParserOutput {
  const title = extractTitle(html);
  const metaTitle = normalizeName(extractMetaContent(html, "og:title"));
  const links = extractLinks(html, url);
  const json = extractFromJsonLd(html);
  const booking = url.includes("booksy.com") ? url : firstByHost(links, ["booksy.com"]);
  const instagram = firstByHost(links, ["instagram.com"]);
  const addressFromMeta = extractMetaContent(html, "business:contact_data:street_address");
  const cityFromMeta = normalizeCity(extractMetaContent(html, "business:contact_data:locality"));
  const addressFromBody = getFirstMatch(
    html,
    /(\d{2,6}\s+[A-Za-z0-9.\-\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[^<\n]*)/i
  );

  const listing = looksLikeListing(url, html);
  const name = json.name || metaTitle || title || normalizeName(preliminaryName);
  const address = json.address || addressFromMeta || addressFromBody;
  const city = json.city || cityFromMeta || extractCityFromAddress(address) || normalizeCity(preliminaryCity);

  return {
    name,
    address,
    city,
    booking,
    website: json.website,
    instagram,
    evidenceType: listing ? "directory_listing" : "direct_operator",
  };
}

