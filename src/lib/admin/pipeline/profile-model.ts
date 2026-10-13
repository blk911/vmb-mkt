import type { ParsedCandidateRow } from "@/lib/source-intake/types";
import type { BookingPlatform, CandidateProfile, ProfileLink, ProfileLinkKind } from "./profile-types";

const PLATFORM_LABELS: Record<BookingPlatform, string> = {
  vagaro: "Vagaro", glossgenius: "GlossGenius", booksy: "Booksy", fresha: "Fresha", square: "Square", unknown: "Unknown",
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Lexical screening only. Fetchers must also validate resolved IPs and every redirect. */
export function isSafePublicProfileUrl(value: string): boolean {
  if (!value || value.length > 2048 || value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return false;
    if (url.port && !["80", "443"].includes(url.port)) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // Reject IP literals (including URL-normalized numeric/hex IPv4), local and internal names.
    if (!host.includes(".") || host.includes(":") || /^[\d.]+$/.test(host)) return false;
    if (host === "localhost" || /\.(localhost|local|internal|test|invalid|onion)$/.test(host)) return false;
    if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))) return false;
    return true;
  } catch {
    return false;
  }
}

export type ClassifiedProfileUrl = {
  url: string;
  platform: BookingPlatform;
  kind: ProfileLinkKind;
  businessId?: string;
  providerId?: string;
};

function queryId(url: URL, keys: string[]): string | undefined {
  for (const [key, value] of url.searchParams) {
    if (keys.includes(key.toLowerCase()) && value.trim()) return value;
  }
  return undefined;
}

/** Classifies observed URLs without fabricating a platform deep link or provider identity. */
export function classifyProfileUrl(value: string): ClassifiedProfileUrl | null {
  if (!isSafePublicProfileUrl(value)) return null;
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  const path = parsed.pathname.toLowerCase();
  const platform: BookingPlatform = hostMatches(host, "vagaro.com") ? "vagaro"
    : hostMatches(host, "glossgenius.com") ? "glossgenius"
      : hostMatches(host, "booksy.com") ? "booksy"
        : hostMatches(host, "fresha.com") ? "fresha"
          : hostMatches(host, "squareup.com") || hostMatches(host, "square.site") ? "square" : "unknown";
  const social = ["instagram.com", "tiktok.com", "facebook.com", "youtube.com", "pinterest.com", "threads.net"].some((domain) => hostMatches(host, domain));
  if (platform === "unknown") return { url: value, platform, kind: social ? "social" : "website" };

  let businessId = queryId(parsed, ["businessid", "business_id", "bid", "locationid", "location_id"]);
  const explicitProviderId = queryId(parsed, ["providerid", "provider_id", "serviceproviderid", "service_provider_id", "staffid", "staff_id", "employeeid", "employee_id", "teammemberid", "team_member_id"]);
  const providerPath = path.match(/\/(?:providers?|staff|team-members?|employees?)\/([^/]+)/);
  // Match against the original segments so IDs retain their observed case/encoding.
  const providerPathIndex = segments.findIndex((segment) => /^(providers?|staff|team-members?|employees?)$/i.test(segment));
  const providerId = explicitProviderId || (providerPath ? segments[providerPathIndex + 1] : undefined);
  const directory = /\/(?:professionals|search|directory|marketplace|listing|listings)(?:\/|$)/.test(path);
  if (directory) return { url: value, platform, kind: "directory", businessId, providerId };

  if (!businessId && platform === "vagaro") {
    // Region-routing prefixes are not businesses. Keep the following observed slug.
    const businessIndex = /^(?:us|ca|gb|uk|au)(?:\d{1,2})?$/i.test(segments[0] || "") ? 1 : 0;
    const businessSlug = segments[businessIndex];
    const navigationRoute = /^(?:pro|support|help|docs|developer|developers|login|log-in|signin|sign-in|signup|sign-up|logout|account|accounts|myaccount|profile|services|appointments|book|booking|about|contact|privacy|terms|pricing|features|careers|blog|business|businesses)$/i;
    const navigationHost = /^(?:support|help|docs|developer|developers|blog)\.vagaro\.com$/i.test(host);
    if (businessSlug && !navigationRoute.test(businessSlug) && !navigationHost) businessId = businessSlug;
  }
  if (!businessId && platform === "glossgenius") {
    const subdomain = host.slice(0, -".glossgenius.com".length);
    if (host !== "glossgenius.com" && !/^(?:www|app|help|support|blog|book)$/.test(subdomain)) businessId = subdomain;
  }
  if (!businessId && platform === "booksy") businessId = segments.find((segment) => /^\d+_/.test(segment))?.match(/^(\d+)_/)?.[1];
  if (!businessId && platform === "fresha") {
    const index = segments.findIndex((segment) => segment.toLowerCase() === "a");
    if (index >= 0) businessId = segments[index + 1];
  }
  if (!businessId && platform === "square") {
    const index = segments.findIndex((segment) => segment.toLowerCase() === "book");
    if (index >= 0 && segments[index - 1]?.toLowerCase() === "appointments") businessId = segments[index + 1];
    if (host.endsWith(".square.site")) businessId ||= host.slice(0, -".square.site".length);
  }
  return {
    url: value, platform, businessId, providerId,
    kind: providerId ? "individual" : businessId ? "shared_business" : "unknown",
  };
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function trimmed(value?: string): string | undefined { return value?.trim() || undefined; }
function identityKey(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }

/** A profile handle is identity; a post, tagged page, or somebody else's pasted bio is context. */
export function candidateInstagramUrl(value?: string): string | undefined {
  const raw = trimmed(value);
  if (!raw) return undefined;
  if (/^@?[a-z0-9._]{1,30}$/i.test(raw) && !raw.includes("instagram.com")) return `https://www.instagram.com/${raw.replace(/^@/, "")}/`;
  if (!isSafePublicProfileUrl(raw)) return undefined;
  const parsed = new URL(raw);
  if (!["instagram.com", "www.instagram.com"].includes(parsed.hostname.toLowerCase())) return undefined;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1 || !/^[a-z0-9._]{1,30}$/i.test(segments[0])) return undefined;
  if (/^(p|reels?|tv|stories|explore|accounts|about|directory|developer|legal|policies)$/i.test(segments[0])) return undefined;
  return raw;
}

function instagramIdentity(value: string): string { return new URL(value).pathname.replace(/\//g, "").toLowerCase(); }

/** Pure projection: no store reads, network requests, mutations, or intake-wide fallback. */
export function recoverCandidateProfile(candidate: ParsedCandidateRow): CandidateProfile {
  const reasons: string[] = [];
  let raw: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(candidate.rawBlock);
    if (value && typeof value === "object" && !Array.isArray(value)) raw = value as Record<string, unknown>;
  } catch { /* Unstructured evidence is retained verbatim, but never scanned for arbitrary people's URLs. */ }
  const rawName = stringField(raw, ["displayName", "name", "fullName", "operatorName", "techName"]);
  if (rawName && identityKey(rawName) !== identityKey(candidate.displayName)) {
    raw = {};
    reasons.push("conflicting_raw_candidate_identity");
  }
  const directory = raw.sourceNote === "vagaro_directory_results" || raw.pageClassification === "directory_results_page" || candidate.parseWarnings?.includes("vagaro_directory_results");
  const sourceContextUrl = trimmed(candidate.sourceContextUrl) || (directory ? stringField(raw, ["sourceUrl"]) : undefined);
  const rawSource = stringField(raw, directory ? ["listingUrl", "profileUrl"] : ["listingUrl", "profileUrl", "detailUrl", "sourceUrl", "url"]);
  const explicitSource = trimmed(candidate.sourceUrl) || rawSource;
  const sourceUrl = sourceContextUrl || explicitSource || "";
  const bookingLinks: ProfileLink[] = [];
  const socialLinks: ProfileLink[] = [];
  const websiteLinks: ProfileLink[] = [];
  const seen = new Set<string>();
  const handleUrl = candidateInstagramUrl(candidate.instagramHandle);
  const instagramInputs = [
    handleUrl,
    candidateInstagramUrl(candidate.instagramProfileUrl),
    ...["instagram", "instagramUrl", "instagramProfileUrl", "instagramHandle", "ig"].map((key) => candidateInstagramUrl(stringField(raw, [key]))),
    candidateInstagramUrl(explicitSource),
  ].filter((value): value is string => Boolean(value));
  const uniqueInstagramIdentities = new Set(instagramInputs.map(instagramIdentity));
  const instagramConflict = uniqueInstagramIdentities.size > 1;
  if (instagramConflict) reasons.push("conflicting_instagram_identity");

  function add(value?: string, purpose?: "booking" | "website" | "social"): void {
    if (!value || seen.has(value)) return;
    const classified = classifyProfileUrl(value);
    if (!classified) { reasons.push("unsafe_source_url_omitted"); return; }
    if (classified.kind === "social" && new URL(value).hostname.toLowerCase().endsWith("instagram.com")) {
      const profile = candidateInstagramUrl(value);
      if (!profile || instagramConflict) return;
    }
    seen.add(value);
    const link: ProfileLink = {
      ...classified,
      attribution: classified.kind === "directory" ? "unresolved" : classified.kind === "shared_business" ? "business" : "candidate",
      sourceUrl: sourceUrl || value,
      basis: directory ? "directory_card" : "submitted",
    };
    if (classified.kind === "social" || purpose === "social") socialLinks.push(link);
    else if (classified.platform !== "unknown" || purpose === "booking") bookingLinks.push(link);
    else websiteLinks.push(link);
  }
  // Only explicit candidate fields and the candidate's own structured block are eligible.
  add(trimmed(candidate.bookingUrl) || stringField(raw, ["bookingUrl", "booking", "bookingLink", "schedulerUrl"]), "booking");
  add(explicitSource);
  add(trimmed(candidate.websiteUrl) || stringField(raw, ["websiteUrl", "website", "site"]), "website");
  if (!instagramConflict) for (const value of instagramInputs) add(value, "social");
  if (directory && sourceContextUrl && !bookingLinks.length) add(sourceContextUrl);

  const knownPlatforms = [...new Set(bookingLinks.map((link) => link.platform).filter((value): value is BookingPlatform => Boolean(value && value !== "unknown")))];
  const platform = knownPlatforms.length === 1 ? knownPlatforms[0] : "unknown";
  if (knownPlatforms.length > 1) reasons.push("multiple_booking_platforms");
  const preferred = bookingLinks.find((link) => link.kind === "individual") || bookingLinks.find((link) => link.kind === "shared_business") || bookingLinks[0];
  const providerId = trimmed(candidate.providerId) || stringField(raw, ["providerId", "serviceProviderId", "staffId", "employeeId"]) || preferred?.providerId;
  const businessId = trimmed(candidate.businessId) || stringField(raw, ["businessId"]) || preferred?.businessId;
  const hasShared = bookingLinks.some((link) => link.kind === "shared_business");
  const status = reasons.some((reason) => reason.startsWith("conflicting_") || reason === "multiple_booking_platforms") ? "ambiguous"
    : hasShared && !bookingLinks.some((link) => link.kind === "individual") ? "shared_page_only"
      : directory || bookingLinks.length ? "directory_linked" : "not_checked";
  if (hasShared) reasons.push("shared_business_page_requires_provider_match");
  if (bookingLinks.some((link) => link.kind === "individual")) reasons.push("source_reported_provider_link_not_live_verified");
  if (!bookingLinks.length) reasons.push("no_candidate_booking_link");
  return {
    schemaVersion: 1,
    providerName: candidate.displayName,
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    businessName: trimmed(candidate.businessName) || stringField(raw, ["businessName", "salonName", "parentContainerName", "containerName"]),
    city: trimmed(candidate.city) || stringField(raw, ["city", "locationCity"]),
    state: trimmed(candidate.state) || stringField(raw, ["state", "locationState"]),
    postalCode: trimmed(candidate.postalCode) || stringField(raw, ["postalCode", "postal_code", "zip", "zipCode"]),
    providerId, businessId, bookingLinks, socialLinks, websiteLinks,
    sourceContextUrl: sourceContextUrl && isSafePublicProfileUrl(sourceContextUrl) ? sourceContextUrl : undefined,
    status, reasons: [...new Set(reasons)], observations: [], searchStatus: "not_needed",
    freshness: bookingLinks.length || socialLinks.length || websiteLinks.length || candidate.city || raw.city ? "source_reported" : "unknown",
  };
}
