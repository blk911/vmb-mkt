import { classifyPage } from "./page-classifier";
import { normalizeCity, normalizeName } from "./normalize";
import { parseBooksy } from "./domain-parsers/booksy";
import { parseFresha } from "./domain-parsers/fresha";
import { parseSola } from "./domain-parsers/sola";
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
} from "./domain-parsers/shared";
import { parseVagaro } from "./domain-parsers/vagaro";
import type { PageClassification, SourceRecord } from "./types";
import type { DomainParserOutput } from "./domain-parsers/shared";

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
  childQuerySeeds?: string[];
  parserUsed?: string;
};

const BOOKING_HOST_HINTS = ["glossgenius.com", "vagaro.com", "styleseat.com", "booksy.com", "fresha.com", "square.site"];
const SOCIAL_HOST_HINTS = ["instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com"];

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

export function extractFromPage(url: string, html: string, preliminary: SourceRecord): ExtractedPageFields {
  const evidenceType = classifyPage(url, html);
  const parser = getParser(url);
  const parserOutput = parser?.run(url, html, preliminary.name, preliminary.city);
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "og:title");
  const siteName = extractMetaContent(html, "og:site_name");
  const phoneFromMeta = extractMetaContent(html, "telephone");
  const links = extractLinks(html, url);
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
    evidenceType: parserOutput?.evidenceType || evidenceType,
    parserUsed: parser?.name,
    name: parserOutput?.name || jsonName || normalizeName(ogTitle) || title || normalizeName(preliminary.name),
    address: parserOutput?.address || address || preliminary.address,
    city: parserOutput?.city || city || normalizeCity(preliminary.city),
    phone: phone || phoneFromBody || preliminary.phone,
    website: parserOutput?.website || website || preliminary.website,
    instagram: parserOutput?.instagram || instagram || preliminary.instagram,
    booking: parserOutput?.booking || booking || preliminary.booking,
    parentContainerName: parserOutput?.parentContainerName || parentContainerName || preliminary.parentContainerName,
    childQuerySeeds: parserOutput?.childQuerySeeds,
  };
}

