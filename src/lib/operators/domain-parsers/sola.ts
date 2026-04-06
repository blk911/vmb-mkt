import { normalizeCity, normalizeName } from "../normalize";
import type { DomainParserOutput } from "./shared";
import { extractCityFromAddress, extractLinks, extractMetaContent, extractTitle, firstByHost, getFirstMatch } from "./shared";

function extractAddress(html: string): string | undefined {
  const fromMeta = extractMetaContent(html, "business:contact_data:street_address");
  if (fromMeta) return fromMeta;
  const fromBody = getFirstMatch(
    html,
    /(\d{2,6}\s+[A-Za-z0-9.\-\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[^<\n]*)/i
  );
  return fromBody;
}

function cleanLocationTitle(title?: string): string | undefined {
  if (!title) return undefined;
  const normalized = title.split("|")[0]?.replace(/Sola Salon Studios?/gi, "").trim();
  return normalizeName(normalized || title);
}

function buildChildSeeds(parentContainerName?: string, city?: string, address?: string): string[] {
  const seeds = new Set<string>();
  if (parentContainerName && city) seeds.add(`${parentContainerName} ${city} nails`);
  if (address) {
    seeds.add(`${address} nails`);
    seeds.add(`${address} lashes`);
  }
  if (parentContainerName) seeds.add(`${parentContainerName} booking`);
  return [...seeds];
}

export function parseSola(url: string, html: string, preliminaryName?: string, preliminaryCity?: string): DomainParserOutput {
  const title = extractTitle(html);
  const siteName = extractMetaContent(html, "og:site_name");
  const ogTitle = extractMetaContent(html, "og:title");
  const links = extractLinks(html, url);
  const parentContainerName = cleanLocationTitle(ogTitle || title || siteName || preliminaryName);
  const address = extractAddress(html);
  const city = normalizeCity(extractMetaContent(html, "business:contact_data:locality")) ||
    extractCityFromAddress(address) ||
    normalizeCity(preliminaryCity);
  const instagram = firstByHost(links, ["instagram.com"]);
  const booking = firstByHost(links, ["booksy.com", "vagaro.com", "fresha.com", "styleseat.com", "glossgenius.com", "square.site"]);

  return {
    name: normalizeName(preliminaryName),
    parentContainerName,
    address,
    city,
    instagram,
    booking,
    website: url,
    evidenceType: "suite_container",
    childQuerySeeds: buildChildSeeds(parentContainerName, city, address),
  };
}

