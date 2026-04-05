import type { HarvestPlatform, HarvestQuery, HarvestQueryPack } from "@/lib/social-targets/operator-harvest/types";

const DEFAULT_CATEGORY = "nails";
const DEFAULT_GEO_LABELS = ["DTC", "Greenwood Village", "Denver", "Centennial", "Cherry Creek", "Lone Tree", "Englewood"];
const NAIL_SERVICE_TERMS = [
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

type BookingHostRule = {
  platform: HarvestPlatform;
  hostToken: string;
};

const BOOKING_HOSTS: BookingHostRule[] = [
  { platform: "glossgenius", hostToken: "glossgenius.com" },
  { platform: "vagaro", hostToken: "vagaro.com" },
  { platform: "styleseat", hostToken: "styleseat.com" },
  { platform: "booksy", hostToken: "booksy.com" },
  { platform: "fresha", hostToken: "fresha.com" },
  { platform: "square", hostToken: "square.site" },
];

function cleanTerm(v?: string): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim().replace(/\s+/g, " ");
  return trimmed || undefined;
}

function quote(v: string): string {
  return `"${v.replace(/"/g, "").trim()}"`;
}

function pushUnique(out: HarvestQuery[], next: HarvestQuery): void {
  if (!next.query.trim()) return;
  if (out.some((q) => q.query.toLowerCase() === next.query.toLowerCase())) return;
  out.push(next);
}

function fallbackGeoLabels(geoLabels?: string[]): string[] {
  const cleaned = (geoLabels ?? [])
    .map(cleanTerm)
    .filter((v): v is string => Boolean(v))
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
  if (cleaned.length) return cleaned;
  return DEFAULT_GEO_LABELS;
}

function serviceTerms(category?: string): string[] {
  const c = cleanTerm(category)?.toLowerCase() ?? DEFAULT_CATEGORY;
  if (c === "nails" || c.includes("nail")) return [...NAIL_SERVICE_TERMS];
  return [c, ...NAIL_SERVICE_TERMS].slice(0, 10);
}

function addInstagramQueries(out: HarvestQuery[], geoLabel: string, term: string): void {
  pushUnique(out, {
    query: `site:instagram.com ${quote(term)} ${quote(geoLabel)}`,
    family: "instagram_operator",
    targetPlatform: "instagram",
    geoLabel,
    serviceHint: term,
  });
}

function addBookingQueries(out: HarvestQuery[], geoLabel: string, term: string): void {
  for (const host of BOOKING_HOSTS) {
    pushUnique(out, {
      query: `site:${host.hostToken} ${term} ${geoLabel}`,
      family: "booking_operator",
      targetPlatform: host.platform,
      geoLabel,
      serviceHint: term,
    });
  }
}

function addFeederQueries(out: HarvestQuery[], geoLabel: string): void {
  pushUnique(out, {
    query: `Sola nails ${geoLabel}`,
    family: "suite_feeder",
    targetPlatform: "suite_directory",
    geoLabel,
    serviceHint: "nails",
  });
  pushUnique(out, {
    query: `Phenix nails ${geoLabel}`,
    family: "suite_feeder",
    targetPlatform: "suite_directory",
    geoLabel,
    serviceHint: "nails",
  });
  pushUnique(out, {
    query: `salon suites nail tech ${geoLabel}`,
    family: "suite_feeder",
    targetPlatform: "suite_directory",
    geoLabel,
    serviceHint: "nail tech",
  });
  pushUnique(out, {
    query: `Yelp nail tech ${geoLabel}`,
    family: "yelp_feeder",
    targetPlatform: "yelp",
    geoLabel,
    serviceHint: "nail tech",
  });
  pushUnique(out, {
    query: `Yelp nail salon ${geoLabel}`,
    family: "yelp_feeder",
    targetPlatform: "yelp",
    geoLabel,
    serviceHint: "nail salon",
  });
}

export function buildOperatorHarvestQueryPack(input?: {
  category?: string;
  geoLabels?: string[];
  maxQueries?: number;
}): HarvestQueryPack {
  const category = cleanTerm(input?.category)?.toLowerCase() ?? DEFAULT_CATEGORY;
  const geoLabels = fallbackGeoLabels(input?.geoLabels);
  const maxQueries = Math.max(8, Math.min(120, input?.maxQueries ?? 30));
  const services = serviceTerms(category);

  const queries: HarvestQuery[] = [];
  const baseService = services[0] ?? "nails";
  const bookingPrimaryTerms = services.slice(0, 2);

  // Pass 1: guarantee each geo gets baseline IG + booking + feeder coverage.
  for (const geo of geoLabels) {
    addInstagramQueries(queries, geo, baseService);
    for (const term of bookingPrimaryTerms) {
      addBookingQueries(queries, geo, term);
      if (queries.length >= maxQueries) break;
    }
    if (queries.length >= maxQueries) break;
    addFeederQueries(queries, geo);
    if (queries.length >= maxQueries) break;
  }

  // Pass 2: fill remaining budget with round-robin service expansions by geo.
  for (const term of services.slice(1)) {
    for (const geo of geoLabels) {
      addInstagramQueries(queries, geo, term);
      addBookingQueries(queries, geo, term);
      if (queries.length >= maxQueries) break;
    }
    if (queries.length >= maxQueries) break;
  }

  return {
    category,
    geoLabels,
    queries: queries.slice(0, maxQueries),
  };
}
