import { normalizeName } from "@/lib/operators/normalize";

export type SolaDeepExtraction = {
  name?: string;
  website?: string;
  instagram?: string;
  booking?: string;
  phone?: string;
  email?: string;
  category?: string;
  parentContainerName?: string;
  internalDetailLinks?: string[];
  extractionSignals?: string[];
};

const BOOKING_HOST_HINTS = ["booksy.com", "vagaro.com", "fresha.com", "styleseat.com", "glossgenius.com", "square.site"];
const CATEGORY_HINTS: Array<{ category: string; pattern: RegExp }> = [
  { category: "nails", pattern: /\bnail|manicure|pedicure\b/i },
  { category: "lashes", pattern: /\blash|extensions?\b/i },
  { category: "brows", pattern: /\bbrow|microblade|microblading\b/i },
  { category: "hair", pattern: /\bhair|barber|colorist|stylist\b/i },
  { category: "spa", pattern: /\bspa|facial|esthetic|massage\b/i },
];

function parseJsonLd(html: string): Array<Record<string, unknown>> {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const rows: Array<Record<string, unknown>> = [];
  for (const row of blocks) {
    const raw = (row[1] || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) if (item && typeof item === "object") rows.push(item as Record<string, unknown>);
      } else if (parsed && typeof parsed === "object") {
        rows.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore invalid blocks
    }
  }
  return rows;
}

function normalizeUrl(url: string, baseUrl: string): string | undefined {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function firstByHost(urls: string[], hostHint: string[]): string | undefined {
  return urls.find((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return hostHint.some((hint) => host === hint || host.endsWith(`.${hint}`));
    } catch {
      return false;
    }
  });
}

function firstWebsite(urls: string[]): string | undefined {
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host.includes("instagram.com")) continue;
      if (BOOKING_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`))) continue;
      if (host.includes("solasalons.com") || host.includes("solasalonstudios.com")) continue;
      return value;
    } catch {
      // ignore invalid url
    }
  }
  return undefined;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const rows: string[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html))) {
    const url = normalizeUrl((match[1] || "").trim(), baseUrl);
    if (url) rows.push(url);
  }
  return [...new Set(rows)];
}

function extractMeta(html: string, key: string): string | undefined {
  const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const hit = html.match(regex)?.[1]?.trim();
  return hit || undefined;
}

function extractName(html: string): string | undefined {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return normalizeName(h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
  if (h2) return normalizeName(h2.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const itemProp = html.match(/itemprop=["']name["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
  if (itemProp) return normalizeName(itemProp.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return normalizeName((title || "").replace(/\s*\|.*$/, "").trim());
}

function extractInternalDetailLinks(html: string, baseUrl: string): string[] {
  const links = extractLinks(html, baseUrl);
  return links.filter((value) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
      return (host.includes("solasalons.com") || host.includes("solasalonstudios.com")) &&
        /(professional|profile|book|service|team|member|tenant)/i.test(path);
    } catch {
      return false;
    }
  }).slice(0, 20);
}

function extractScriptSurfaceHints(html: string): { website?: string; instagram?: string; booking?: string; phone?: string; email?: string } {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1] || "").slice(0, 80);
  const text = scripts.join("\n");
  const urlHits = [...text.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map((x) => x[0]);
  const telHit = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0];
  const emailHit = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  return {
    instagram: firstByHost(urlHits, ["instagram.com"]),
    booking: firstByHost(urlHits, BOOKING_HOST_HINTS),
    website: firstWebsite(urlHits),
    phone: telHit?.trim() || undefined,
    email: emailHit?.trim() || undefined,
  };
}

export function isSolaChildDetailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host.includes("solasalons.com") || host.includes("solasalonstudios.com"))) return false;
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    return /(professional|profile|book|member|team|service|tenant)/i.test(path);
  } catch {
    return false;
  }
}

export function deepExtractFromSolaChildPage(params: { url: string; html: string }): SolaDeepExtraction {
  const signals: string[] = [];
  const links = extractLinks(params.html, params.url);
  const jsonLdRows = parseJsonLd(params.html);
  const scriptHints = extractScriptSurfaceHints(params.html);

  const name = extractName(params.html);
  if (name) signals.push("name_from_heading_or_title");

  let website = firstWebsite(links);
  let instagram = firstByHost(links, ["instagram.com"]);
  let booking = firstByHost(links, BOOKING_HOST_HINTS);
  let phone = links.find((x) => x.toLowerCase().startsWith("tel:"))?.replace(/^tel:/i, "").trim();
  let email = links.find((x) => x.toLowerCase().startsWith("mailto:"))?.replace(/^mailto:/i, "").trim();
  let parentContainerName = extractMeta(params.html, "og:site_name");

  for (const row of jsonLdRows) {
    const jsonUrl = typeof row.url === "string" ? row.url.trim() : undefined;
    const jsonPhone = typeof row.telephone === "string" ? row.telephone.trim() : undefined;
    const jsonEmail = typeof row.email === "string" ? row.email.trim() : undefined;
    website ||= jsonUrl && firstWebsite([jsonUrl]);
    booking ||= jsonUrl && firstByHost([jsonUrl], BOOKING_HOST_HINTS);
    phone ||= jsonPhone;
    email ||= jsonEmail;
    if (!parentContainerName && typeof row.name === "string" && /sola|salon studios/i.test(row.name)) {
      parentContainerName = row.name.trim();
    }
  }

  website ||= scriptHints.website;
  instagram ||= scriptHints.instagram;
  booking ||= scriptHints.booking;
  phone ||= scriptHints.phone;
  email ||= scriptHints.email;

  if (website) signals.push("website_found");
  if (instagram) signals.push("instagram_found");
  if (booking) signals.push("booking_found");
  if (phone) signals.push("phone_found");
  if (email) signals.push("email_found");

  const categoryText = `${params.html.slice(0, 30000)} ${name || ""}`;
  const category = CATEGORY_HINTS.find((row) => row.pattern.test(categoryText))?.category;
  if (category) signals.push("category_hint_found");

  const internalDetailLinks = extractInternalDetailLinks(params.html, params.url);
  if (internalDetailLinks.length) signals.push("internal_detail_links_found");

  return {
    name: name || undefined,
    website: website || undefined,
    instagram: instagram || undefined,
    booking: booking || undefined,
    phone: phone || undefined,
    email: email || undefined,
    category,
    parentContainerName: normalizeName(parentContainerName) || undefined,
    internalDetailLinks,
    extractionSignals: signals,
  };
}
