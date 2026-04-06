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

function listingLike(url: string, html: string): boolean {
  const u = url.toLowerCase();
  const h = html.toLowerCase();
  return /\/(listing|listings|search|directory|marketplace)\b/.test(u) || h.includes("find a salon");
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

