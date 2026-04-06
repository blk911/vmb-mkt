import type { PageClassification } from "./types";

const DIRECTORY_DOMAINS = [
  "yelp.com",
  "yellowpages.com",
  "foursquare.com",
  "mapquest.com",
  "booksy.com",
  "vagaro.com",
  "fresha.com",
];

const SUITE_CONTAINER_DOMAINS = [
  "phenixsalonsuites.com",
  "solasalonstudios.com",
  "mysalonsuite.com",
  "salonlofts.com",
  "salonsuites.com",
];

const SOCIAL_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
];

const BOOKING_DOMAINS = [
  "glossgenius.com",
  "vagaro.com",
  "styleseat.com",
  "booksy.com",
  "fresha.com",
  "square.site",
  "booking.page",
];

function parseUrl(input: string): URL | undefined {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
}

function domainIncludes(host: string, domains: string[]) {
  const normalized = host.toLowerCase();
  return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

export function classifyPage(inputUrl: string, html?: string): PageClassification {
  const parsed = parseUrl(inputUrl);
  if (!parsed) return "unknown";

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const haystack = `${host}${path}`;

  if (domainIncludes(host, SOCIAL_DOMAINS)) return "social_profile";
  if (domainIncludes(host, SUITE_CONTAINER_DOMAINS)) return "suite_container";

  if (domainIncludes(host, BOOKING_DOMAINS)) {
    if (/\/(directory|location|locations|marketplace|search|categories|listings?)\b/.test(path)) return "directory_listing";
    if (/\/(business|salon|barber|nails?|lashes?|spa|book)\b/.test(path)) return "direct_operator";
    if (domainIncludes(host, DIRECTORY_DOMAINS)) return "directory_listing";
    return "direct_operator";
  }

  if (domainIncludes(host, DIRECTORY_DOMAINS)) return "directory_listing";

  if (/\/(directory|listing|listings|location|locations|providers?)\b/.test(path)) {
    return "directory_listing";
  }
  if (/(suite|salon-suites|studios)/.test(haystack)) return "suite_container";
  if (/\/(book|booking|artist|provider|stylist|nail|lash|spa)\b/.test(path)) return "direct_operator";

  if (html) {
    const text = html.toLowerCase();
    if (text.includes("itemtype=\"http://schema.org/localbusiness\"")) return "direct_operator";
    if (text.includes("itemtype=\"https://schema.org/localbusiness\"")) return "direct_operator";
    if (text.includes("salon suites")) return "suite_container";
    if (text.includes("find a professional") || text.includes("directory") || text.includes("search results")) {
      return "directory_listing";
    }
  }

  return "website";
}

