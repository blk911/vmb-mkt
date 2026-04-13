import crypto from "node:crypto";
import type {
  ExternalSiteRawResult,
  ExtractedBusinessProfile,
  ExtractedProviderRecord,
  ExtractedServiceRecord,
  ExternalSourceType,
} from "./types";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))];
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function hashId(prefix: string, value: string): string {
  return `${prefix}_${crypto.createHash("md5").update(value).digest("hex").slice(0, 12)}`;
}

function toAbsoluteUrl(rawUrl: string, baseUrl: string): string | undefined {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isLikelyJunkText(value: string): boolean {
  return /^(services?|about|team|book now|book|contact|home|reviews?|login|menu)$/i.test(value.trim());
}

function containsReservedNavigationWords(value: string): boolean {
  return /\b(services?|about|team|book|view all|get in touch|contact|instagram|facebook|tiktok|home|menu|terms|privacy|policy)\b/i.test(value);
}

function matchAll<T>(pattern: RegExp, input: string, map: (match: RegExpExecArray) => T | undefined): T[] {
  const hits: T[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(input))) {
    const value = map(match);
    if (value !== undefined) hits.push(value);
  }
  return hits;
}

function extractBusinessName(raw: ExternalSiteRawResult): string | undefined {
  const ogTitle = raw.html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)?.[1];
  const h1 = stripHtml(raw.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const title = raw.title?.split("|")[0]?.trim();
  return [h1, ogTitle, title].map((value) => value?.trim()).find(Boolean);
}

type AnchorRecord = { href: string; text: string };

function extractAnchors(html: string, baseUrl: string): AnchorRecord[] {
  const hits = matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, html, (match) => {
    const href = toAbsoluteUrl(match[1], baseUrl);
    const text = stripHtml(match[2]);
    return href ? { href, text } : undefined;
  });
  const seen = new Set<string>();
  return hits.filter((row) => {
    const key = `${row.href}|${normalizeForCompare(row.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSocialLinks(anchors: AnchorRecord[]) {
  return {
    instagramUrl: anchors.find((row) => /instagram\.com/i.test(row.href))?.href,
    facebookUrl: anchors.find((row) => /facebook\.com/i.test(row.href))?.href,
    tiktokUrl: anchors.find((row) => /tiktok\.com/i.test(row.href))?.href,
  };
}

function extractBookingUrl(anchors: AnchorRecord[], baseUrl: string): string | undefined {
  return anchors.find((row) => /(book|booking|reserve|schedule|appointment|services|glossgenius)/i.test(`${row.href} ${row.text}`))?.href
    || (baseUrl.includes("glossgenius.com") ? baseUrl : undefined);
}

function extractCtaLinks(anchors: AnchorRecord[]): string[] {
  return uniqueStrings(
    anchors
      .filter((row) => /(book|booking|reserve|schedule|appointment|services|call|instagram|facebook|tiktok)/i.test(`${row.text} ${row.href}`))
      .map((row) => row.href)
  ).slice(0, 12);
}

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const hits = matchAll(/<(?:img|source|meta)[^>]+(?:src|srcset|content)=["']([^"']+)["'][^>]*>/gi, html, (match) => {
    const rawValue = match[1].split(",")[0]?.trim().split(" ")[0];
    if (!rawValue) return undefined;
    const resolved = toAbsoluteUrl(rawValue, baseUrl);
    if (!resolved) return undefined;
    if (!/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(resolved) && !/[?&](?:format|w|h)=/i.test(resolved)) return undefined;
    if (/(favicon|sprite|icon|placeholder|blank|pixel|spacer)/i.test(resolved)) return undefined;
    return resolved;
  });

  return uniqueStrings(hits).filter((url) => !/googletagmanager|doubleclick|facebook\.com\/tr/i.test(url));
}

function chooseHeroImage(raw: ExternalSiteRawResult, imageUrls: string[]): string | undefined {
  const ogImage = raw.html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)?.[1];
  const absoluteOgImage = ogImage ? toAbsoluteUrl(ogImage, raw.finalUrl) : undefined;
  if (absoluteOgImage) return absoluteOgImage;
  return imageUrls.find((url) => !/(logo|avatar|profile)/i.test(url)) || imageUrls[0];
}

function chooseLogoImage(imageUrls: string[]): string | undefined {
  return imageUrls.find((url) => /logo/i.test(url));
}

function extractPhone(html: string): string | undefined {
  const telHref = html.match(/tel:([^"']+)/i)?.[1]?.trim();
  if (telHref) return telHref;
  return stripHtml(html.match(/(\+?1?[\s().-]*\d{3}[\s().-]*\d{3}[\s().-]*\d{4})/)?.[1] || "");
}

function extractAddress(html: string): string | undefined {
  const candidate =
    html.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1] ||
    html.match(/"address"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/Denver,\s*CO[^<"\n]{0,80}/i)?.[0];
  const normalized = stripHtml(candidate || "");
  return normalized || undefined;
}

function extractTextBlocks(html: string): { textBlocks: string[]; duplicateCount: number } {
  const rawBlocks = matchAll(/<(?:p|li|div|span)[^>]*>([\s\S]*?)<\/(?:p|li|div|span)>/gi, html, (match) =>
    stripHtml(match[1])
  )
    .filter((value) => value.length >= 20 && value.length <= 320)
    .filter((value) => !/^(book|services|contact|home)$/i.test(value));

  const seen = new Set<string>();
  let duplicateCount = 0;
  const deduped = rawBlocks.filter((value) => {
    const key = normalizeForCompare(value);
    if (seen.has(key)) {
      duplicateCount += 1;
      return false;
    }
    seen.add(key);
    return true;
  });

  return {
    textBlocks: deduped.slice(0, 24),
    duplicateCount,
  };
}

function parseVisibleTextLines(html: string): string[] {
  return stripHtml(html)
    .split(/(?=[A-Z][a-z])|•|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractServiceRecords(html: string, imageUrls: string[]): ExtractedServiceRecord[] {
  const services: ExtractedServiceRecord[] = [];
  const seen = new Set<string>();

  const headingMatches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (let index = 0; index < headingMatches.length; index += 1) {
    const title = stripHtml(headingMatches[index][1]);
    if (!title || isLikelyJunkText(title) || title.length > 120 || /\bsalon\b/i.test(title) || title.includes("|")) continue;
    const block = html.slice(headingMatches[index].index || 0, (headingMatches[index + 1]?.index || (headingMatches[index].index || 0) + 1200));
    const key = normalizeForCompare(title);
    if (seen.has(key)) continue;

    const priceLabel = block.match(/\$\s?\d+(?:\.\d{2})?\+?/i)?.[0];
    const durationLabel = block.match(/\b\d+\+?\s*(?:min|mins|minutes|hr|hrs|hour|hours)\b/i)?.[0];
    const optionsLabel = block.match(/\b\d+\s+options?\b/i)?.[0];
    const looksServiceLike = /(\bmanicure|\bpedicure|\bgel|\bfull set|\bfill|\bcut|\bcolor|\blash|\bextension|\bfacial|\bwax|\bnails?)/i.test(title);
    if (!looksServiceLike && !priceLabel && !durationLabel && !optionsLabel) continue;
    seen.add(key);
    const description = [optionsLabel].filter(Boolean).join(" • ") || undefined;
    services.push({
      id: hashId("svc", title),
      title,
      subtitle: optionsLabel || undefined,
      description,
      priceLabel,
      durationLabel,
      imageUrl: imageUrls[index],
    });
  }

  if (services.length >= 3) return services.slice(0, 18);

  const fallbackCandidates = uniqueStrings(parseVisibleTextLines(html))
    .filter((value) => value.length >= 3 && value.length <= 100)
    .filter((value) => !isLikelyJunkText(value))
    .filter((value) => /(\bmanicure|\bpedicure|\bgel|\bfull set|\bfill|\bcut|\bcolor|\blash|\bextension|\bfacial|\bwax|\bnails?)/i.test(value));

  for (const title of fallbackCandidates) {
    const key = normalizeForCompare(title);
    if (seen.has(key)) continue;
    seen.add(key);
    services.push({
      id: hashId("svc", title),
      title,
      imageUrl: imageUrls[services.length],
    });
  }

  return services.slice(0, 18);
}

function extractProviderRecords(html: string, imageUrls: string[]): ExtractedProviderRecord[] {
  const records: ExtractedProviderRecord[] = [];
  const seen = new Set<string>();

  const providerMatches = matchAll(/"providerName"\s*:\s*"([^"]+)"/gi, html, (match) => match[1]);
  const candidates = uniqueStrings([
    ...providerMatches,
    ...matchAll(/<(?:h3|h4|strong|span|div)[^>]*>([\s\S]*?)<\/(?:h3|h4|strong|span|div)>/gi, html, (match) => stripHtml(match[1])),
  ]);

  for (const candidate of candidates) {
    if (isLikelyJunkText(candidate)) continue;
    if (containsReservedNavigationWords(candidate)) continue;
    if (!/^[A-Z][A-Za-z'`-]+(?:\s+[A-Z][A-Za-z'`-]+){0,3}$/.test(candidate)) continue;
    if (candidate === candidate.toUpperCase()) continue;
    const key = normalizeForCompare(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      id: hashId("prov", candidate),
      name: candidate,
      title: "Provider",
      imageUrl: imageUrls.find((url) => new RegExp(candidate.split(" ")[0], "i").test(url)),
    });
  }

  return records.slice(0, 16);
}

export function parseGlossGeniusProfile(raw: ExternalSiteRawResult, sourceType: ExternalSourceType): ExtractedBusinessProfile {
  const anchors = extractAnchors(raw.html, raw.finalUrl);
  const socialLinks = extractSocialLinks(anchors);
  const bookingUrl = extractBookingUrl(anchors, raw.finalUrl);
  const ctaLinks = extractCtaLinks(anchors);
  const imageCandidates = extractImageCandidates(raw.html, raw.finalUrl);
  const heroImageUrl = chooseHeroImage(raw, imageCandidates);
  const logoImageUrl = chooseLogoImage(imageCandidates);
  const imageUrls = imageCandidates.filter((url) => url !== logoImageUrl);
  const { textBlocks, duplicateCount } = extractTextBlocks(raw.html);
  const services = extractServiceRecords(raw.html, imageUrls);
  const providers = extractProviderRecords(raw.html, imageUrls);

  return {
    businessName: extractBusinessName(raw),
    sourceType,
    sourceUrl: raw.finalUrl,
    bookingUrl,
    heroImageUrl,
    logoImageUrl,
    services,
    providers,
    socialLinks,
    contact: {
      phone: extractPhone(raw.html),
      address: extractAddress(raw.html),
    },
    ctaLinks,
    imageUrls,
    textBlocks,
    serviceNames: services.map((service) => service.title),
    providerNames: providers.map((provider) => provider.name),
    filteredDuplicateTextBlocksCount: duplicateCount,
  };
}
