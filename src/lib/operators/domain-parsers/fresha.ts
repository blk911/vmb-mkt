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
} from "./shared";

function isListing(url: string, html: string): boolean {
  const u = url.toLowerCase();
  const h = html.toLowerCase();
  if (/\/(a|search|directory|categories|marketplace)\b/.test(u)) return true;
  if (h.includes("book your next") || h.includes("discover and book")) return true;
  return false;
}

export function parseFresha(url: string, html: string, preliminaryName?: string, preliminaryCity?: string): DomainParserOutput {
  const title = extractTitle(html);
  const ogTitle = normalizeName(extractMetaContent(html, "og:title"));
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
    name: ogTitle || title || normalizeName(preliminaryName),
    address,
    city: city || extractCityFromAddress(address) || normalizeCity(preliminaryCity),
    instagram: firstByHost(links, ["instagram.com"]),
    booking: url.includes("fresha.com") ? url : firstByHost(links, ["fresha.com"]),
    website: undefined,
    evidenceType: isListing(url, html) ? "directory_listing" : "direct_operator",
  };
}

