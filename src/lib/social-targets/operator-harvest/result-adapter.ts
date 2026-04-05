import type {
  HarvestCandidateType,
  HarvestConfidence,
  HarvestPlatform,
  HarvestProspect,
  HarvestQuery,
  HarvestQueryResultSet,
  HarvestRawResult,
} from "@/lib/social-targets/operator-harvest/types";

const BOOKING_PLATFORMS = new Set<HarvestPlatform>(["glossgenius", "vagaro", "styleseat", "booksy", "fresha", "square"]);
const AGGREGATOR_TOKENS = [
  "sola",
  "phenix",
  "salon suites",
  "suite",
  "studios",
  "blusky",
  "my salon suite",
  "salons by jc",
];
const SERVICE_TERMS = [
  "nails",
  "nail tech",
  "nail artist",
  "gel nails",
  "acrylic nails",
  "manicure",
  "nail salon",
  "builder gel",
  "russian manicure",
  "nail studio",
];

function normalizeUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function detectHarvestPlatform(url: string): HarvestPlatform {
  const host = parseHost(url);
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("glossgenius.com")) return "glossgenius";
  if (host.includes("vagaro.com")) return "vagaro";
  if (host.includes("styleseat.com")) return "styleseat";
  if (host.includes("booksy.com")) return "booksy";
  if (host.includes("fresha.com")) return "fresha";
  if (host.includes("square.site") || host.includes("squareup.com")) return "square";
  if (host.includes("yelp.com")) return "yelp";
  if (host.includes("solasalonstudios.com") || host.includes("phenixsalonsuites.com") || host.includes("salonsbyjc.com")) {
    return "suite_directory";
  }
  return "other";
}

function stripNoise(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*[|•-]\s*(instagram|booksy|styleseat|vagaro|glossgenius|fresha|yelp).*$/i, "")
    .trim();
}

function extractName(result: HarvestRawResult): string {
  const title = stripNoise(result.title || "");
  if (title) return title;
  const snippet = stripNoise(result.snippet || "");
  if (snippet) return snippet.slice(0, 64);
  return "Unknown operator";
}

function extractHandle(url: string, platform: HarvestPlatform): string | undefined {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts.length) return undefined;
    const first = parts[0].replace(/^@/, "");
    if (platform === "instagram") {
      if (["p", "reel", "stories", "accounts", "explore"].includes(first.toLowerCase())) return undefined;
      return first || undefined;
    }
    if (platform === "styleseat") return parts[parts.length - 1] || undefined;
    if (platform === "booksy") return parts[parts.length - 1] || undefined;
    if (BOOKING_PLATFORMS.has(platform) || platform === "yelp") return first || undefined;
    return undefined;
  } catch {
    return undefined;
  }
}

function collectGeoHints(query: HarvestQuery, result: HarvestRawResult): string[] {
  const text = `${query.query} ${result.title} ${result.snippet ?? ""}`.toLowerCase();
  const hints = new Set<string>();
  if (query.geoLabel) hints.add(query.geoLabel);
  const known = ["denver", "greenwood village", "dtc", "centennial", "cherry creek", "lone tree", "englewood"];
  for (const geo of known) {
    if (text.includes(geo)) hints.add(geo);
  }
  return [...hints];
}

function collectServiceHints(query: HarvestQuery, result: HarvestRawResult): string[] {
  const text = `${query.query} ${result.title} ${result.snippet ?? ""}`.toLowerCase();
  const out = new Set<string>();
  if (query.serviceHint) out.add(query.serviceHint);
  for (const term of SERVICE_TERMS) {
    if (text.includes(term)) out.add(term);
  }
  return [...out];
}

function classifyCandidateType(name: string, platform: HarvestPlatform, serviceHints: string[]): HarvestCandidateType {
  const lower = name.toLowerCase();
  const operatorMarkers = [" by ", "nail tech", "nail artist", "studio", "artist", "tech"];
  const salonMarkers = ["salon", "spa", "lounge", "bar"];
  const hasAggregatorMarker = AGGREGATOR_TOKENS.some((marker) => lower.includes(marker));
  const hasOperatorMarker = operatorMarkers.some((marker) => lower.includes(marker));
  const hasSalonMarker = salonMarkers.some((marker) => lower.includes(marker));
  if (hasAggregatorMarker) return "ambiguous";
  if (platform === "yelp" || platform === "suite_directory") {
    return hasOperatorMarker ? "operator" : "ambiguous";
  }
  if (hasOperatorMarker && serviceHints.length > 0) return "operator";
  if (hasSalonMarker && !hasOperatorMarker) return "salon";
  if (BOOKING_PLATFORMS.has(platform) && serviceHints.length > 0) return "operator";
  return "ambiguous";
}

function pickConfidence(candidateType: HarvestCandidateType, geoHints: string[], hasInstagram: boolean, hasBooking: boolean): HarvestConfidence {
  let score = 0;
  if (candidateType === "operator") score += 40;
  else if (candidateType === "salon") score += 18;
  else score += 2;
  if (geoHints.length) score += 20;
  if (hasInstagram) score += 25;
  if (hasBooking) score += 25;
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function dmReadyForProspect(
  platforms: HarvestPlatform[],
  candidateType: HarvestCandidateType,
  instagramUrl?: string,
  bookingUrl?: string
): boolean {
  const onlyFeeder = platforms.every((platform) => platform === "suite_directory" || platform === "yelp");
  if (onlyFeeder) return false;
  if (candidateType === "ambiguous" && !bookingUrl) return false;
  if (instagramUrl) return true;
  if (bookingUrl && platforms.some((p) => BOOKING_PLATFORMS.has(p))) return true;
  return false;
}

function normalizeNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mergeDedupKey(candidate: {
  handle?: string;
  instagramUrl?: string;
  name: string;
  geoHints: string[];
}): string {
  const nameKey = normalizeNameKey(candidate.name);
  if (nameKey) return `name:${nameKey}`;
  const handle = candidate.handle?.toLowerCase();
  if (handle) return `handle:${handle}`;
  const ig = candidate.instagramUrl?.toLowerCase();
  if (ig) return `ig:${ig}`;
  return "fallback";
}

function idFromKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `hp-${hash.toString(36)}`;
}

function rankingScore(p: HarvestProspect): number {
  const ig = p.instagramUrl ? 1 : 0;
  const booking = p.bookingUrl ? 1 : 0;
  const operatorBoost = p.candidateType === "operator" ? 20 : p.candidateType === "salon" ? 8 : 0;
  const conf = p.confidence === "high" ? 12 : p.confidence === "medium" ? 6 : 2;
  return ig * 30 + booking * 22 + operatorBoost + conf + (p.dmReady ? 10 : 0);
}

export function adaptHarvestQueryResultsToProspects(resultSet: HarvestQueryResultSet[]): HarvestProspect[] {
  const merged = new Map<string, HarvestProspect>();

  for (const group of resultSet) {
    for (const rawResult of group.results) {
      const url = normalizeUrl(rawResult.url);
      if (!url) continue;
      const platform = detectHarvestPlatform(url);
      const name = extractName(rawResult);
      const handle = extractHandle(url, platform);
      const geoHints = collectGeoHints(group.query, rawResult);
      const serviceHints = collectServiceHints(group.query, rawResult);
      const candidateType = classifyCandidateType(name, platform, serviceHints);

      const seed: HarvestProspect = {
        id: "",
        name,
        ...(handle ? { handle } : {}),
        primaryPlatform: platform,
        profileUrl: url,
        ...(platform === "instagram" ? { instagramUrl: url } : {}),
        ...(BOOKING_PLATFORMS.has(platform) ? { bookingUrl: url } : {}),
        ...(geoHints.length ? { locationLabel: geoHints[0] } : {}),
        geoHints,
        serviceHints,
        sourcePlatforms: [platform],
        sourceQueries: [group.query.query],
        candidateType,
        confidence: "low",
        dmReady: false,
      };

      const key = mergeDedupKey(seed);
      const existing = merged.get(key);
      if (!existing) {
        const withState: HarvestProspect = {
          ...seed,
          id: idFromKey(key),
        };
        withState.dmReady = dmReadyForProspect(
          withState.sourcePlatforms,
          withState.candidateType,
          withState.instagramUrl,
          withState.bookingUrl
        );
        withState.confidence = pickConfidence(
          withState.candidateType,
          withState.geoHints,
          Boolean(withState.instagramUrl),
          Boolean(withState.bookingUrl)
        );
        merged.set(key, withState);
        continue;
      }

      const nextPlatforms = [...new Set([...existing.sourcePlatforms, platform])];
      const nextQueries = [...new Set([...existing.sourceQueries, group.query.query])];
      const nextGeoHints = [...new Set([...existing.geoHints, ...geoHints])];
      const nextServiceHints = [...new Set([...existing.serviceHints, ...serviceHints])];
      const nextCandidateType: HarvestCandidateType =
        existing.candidateType === "operator" || candidateType === "operator"
          ? "operator"
          : existing.candidateType === "salon" || candidateType === "salon"
            ? "salon"
            : "ambiguous";
      const next: HarvestProspect = {
        ...existing,
        sourcePlatforms: nextPlatforms,
        sourceQueries: nextQueries,
        geoHints: nextGeoHints,
        serviceHints: nextServiceHints,
        candidateType: nextCandidateType,
        ...(existing.instagramUrl ? {} : platform === "instagram" ? { instagramUrl: url } : {}),
        ...(existing.bookingUrl ? {} : BOOKING_PLATFORMS.has(platform) ? { bookingUrl: url } : {}),
      };
      const preferredPlatform: HarvestPlatform = next.instagramUrl
        ? "instagram"
        : next.bookingUrl
          ? next.sourcePlatforms.find((p) => BOOKING_PLATFORMS.has(p)) ?? next.primaryPlatform
          : next.primaryPlatform;
      next.primaryPlatform = preferredPlatform;
      next.dmReady = dmReadyForProspect(next.sourcePlatforms, next.candidateType, next.instagramUrl, next.bookingUrl);
      next.confidence = pickConfidence(next.candidateType, next.geoHints, Boolean(next.instagramUrl), Boolean(next.bookingUrl));
      merged.set(key, next);
    }
  }

  return [...merged.values()].sort((a, b) => rankingScore(b) - rankingScore(a));
}
