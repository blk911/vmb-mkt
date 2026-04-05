import type { HarvestQuery, HarvestQueryResultSet, HarvestRawResult } from "@/lib/social-targets/operator-harvest/types";

type PlaceTextSearchResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
};

type PlaceDetailsResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  website?: string;
  url?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSearchQuery(raw: string): string {
  return raw
    .replace(/\bsite:[^\s]+/gi, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeSurfaceUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("instagram.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (!segments.length) return null;
      const head = segments[0].replace(/^@/, "");
      const blocked = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv"]);
      if (blocked.has(head.toLowerCase())) return null;
      return `https://www.instagram.com/${head}/`;
    }
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function extractDomain(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHarvestSurface(url: string): boolean {
  const host = extractDomain(url);
  return [
    "instagram.com",
    "glossgenius.com",
    "vagaro.com",
    "styleseat.com",
    "booksy.com",
    "fresha.com",
    "square.site",
    "squareup.com",
    "yelp.com",
  ].some((token) => host.includes(token));
}

function parseLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const re = /href="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = (match[1] ?? "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const absolute = new URL(href, baseUrl).toString();
      links.push(absolute);
    } catch {
      continue;
    }
  }
  return links;
}

async function fetchWebsiteHarvestLinks(websiteUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(websiteUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VMBOperatorHarvest/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseLinksFromHtml(html, websiteUrl).filter(isHarvestSurface);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function googlePlaceTextSearch(apiKey: string, query: string): Promise<PlaceTextSearchResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("query", query);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: PlaceTextSearchResult[] };
  return Array.isArray(json.results) ? json.results : [];
}

async function googlePlaceDetails(apiKey: string, placeId: string): Promise<PlaceDetailsResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", ["place_id", "name", "formatted_address", "website", "url"].join(","));
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: PlaceDetailsResult };
  return json.result ?? null;
}

function detailToRawResult(detail: PlaceDetailsResult, url: string): HarvestRawResult {
  return {
    title: detail.name?.trim() || "Unknown operator",
    url,
    snippet: detail.formatted_address?.trim() || "Google Places match",
  };
}

export async function executeHarvestQueriesLive(
  queries: HarvestQuery[],
  opts?: { resultsPerQuery?: number; requestDelayMs?: number }
): Promise<HarvestQueryResultSet[]> {
  const resultsPerQuery = Math.max(2, Math.min(8, opts?.resultsPerQuery ?? 5));
  const requestDelayMs = Math.max(0, Math.min(2500, opts?.requestDelayMs ?? 350));
  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (!apiKey) return queries.map((query) => ({ query, results: [] }));

  const detailsCache = new Map<string, PlaceDetailsResult | null>();
  const websiteLinksCache = new Map<string, string[]>();
  const out: HarvestQueryResultSet[] = [];
  for (let i = 0; i < queries.length; i += 1) {
    const query = queries[i];
    const normalized = normalizeSearchQuery(query.query);
    const textResults = await googlePlaceTextSearch(apiKey, normalized).catch(() => []);
    const rows: HarvestRawResult[] = [];
    const seenUrls = new Set<string>();
    for (const place of textResults) {
      const placeId = (place.place_id ?? "").trim();
      if (!placeId) continue;
      const details = detailsCache.has(placeId)
        ? (detailsCache.get(placeId) ?? null)
        : await googlePlaceDetails(apiKey, placeId).catch(() => null);
      detailsCache.set(placeId, details ?? null);
      if (!details) continue;
      const directCandidates = [normalizeUrl(details.website), normalizeUrl(details.url)].filter(
        (value): value is string => Boolean(value)
      );
      for (const candidateUrl of directCandidates) {
        if (!isHarvestSurface(candidateUrl)) continue;
        const normalizedSurface = normalizeSurfaceUrl(candidateUrl);
        if (!normalizedSurface) continue;
        if (seenUrls.has(normalizedSurface.toLowerCase())) continue;
        seenUrls.add(normalizedSurface.toLowerCase());
        rows.push(detailToRawResult(details, normalizedSurface));
      }

      const website = normalizeUrl(details.website);
      if (website) {
        const websiteLinks = websiteLinksCache.has(website)
          ? (websiteLinksCache.get(website) ?? [])
          : await fetchWebsiteHarvestLinks(website);
        websiteLinksCache.set(website, websiteLinks);
        for (const link of websiteLinks) {
          const normalizedSurface = normalizeSurfaceUrl(link);
          if (!normalizedSurface) continue;
          if (seenUrls.has(normalizedSurface.toLowerCase())) continue;
          seenUrls.add(normalizedSurface.toLowerCase());
          rows.push(detailToRawResult(details, normalizedSurface));
          if (rows.length >= resultsPerQuery) break;
        }
      }
      if (rows.length >= resultsPerQuery) break;
    }
    const results = rows.slice(0, resultsPerQuery);
    out.push({ query, results });
    if (i < queries.length - 1 && requestDelayMs > 0) await sleep(requestDelayMs);
  }
  return out;
}
