import type { ParsedCandidateRow } from "@/lib/source-intake/types";
import type { BookingPlatform, CandidateProfile, ProfileFieldEvidence, ProfileFactField, ProfileLink, ProfileLinkKind, ProfilePlatformEvidence } from "./profile-types";

export const PROFILE_FACT_RECOVERY_VERSION = 2;
export const PLATFORM_LABELS: Record<BookingPlatform, string> = {
  vagaro: "Vagaro", glossgenius: "GlossGenius", booksy: "Booksy", fresha: "Fresha", square: "Square", styleseat: "StyleSeat", unknown: "Unknown",
};

export function hostMatches(host: string, domain: string): boolean {
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
    if (host === "localhost" || /\.(localhost|local|internal|intranet|lan|home|test|invalid|example|onion)$/.test(host)) return false;
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
  const normalized = normalizeProfileUrl(value);
  if (!normalized) return null;
  value = normalized;
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  const path = parsed.pathname.toLowerCase();
  const platform: BookingPlatform = hostMatches(host, "vagaro.com") ? "vagaro"
    : hostMatches(host, "glossgenius.com") ? "glossgenius"
      : hostMatches(host, "booksy.com") ? "booksy"
        : hostMatches(host, "fresha.com") ? "fresha"
          : hostMatches(host, "squareup.com") || hostMatches(host, "square.site") ? "square"
            : hostMatches(host, "styleseat.com") ? "styleseat" : "unknown";
  const social = SOCIAL_DOMAINS.some((domain) => hostMatches(host, domain));
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
  if (!businessId && platform === "styleseat") {
    const index = segments[0]?.toLowerCase() === "m" ? segments[1]?.toLowerCase() === "v" ? 2 : 1 : segments[0]?.toLowerCase() === "v" ? 1 : 0;
    if (segments[index] && !/^(?:search|directory|login|signup|blog|pro|professionals|about|contact|terms|privacy)$/i.test(segments[index])) businessId = segments[index];
  }
  return {
    url: value, platform, businessId, providerId,
    kind: providerId ? "individual" : businessId ? "shared_business" : "unknown",
  };
}

const SOCIAL_DOMAINS = ["instagram.com", "tiktok.com", "facebook.com", "fb.com", "fb.me", "youtube.com", "youtu.be", "pinterest.com", "threads.net", "threads.com", "linkedin.com", "twitter.com", "x.com", "snapchat.com"];
const BARE_DOMAINS = ["vagaro.com", "glossgenius.com", "booksy.com", "fresha.com", "squareup.com", "square.site", "styleseat.com", "linktr.ee", ...SOCIAL_DOMAINS];

/** Normalize only observed URLs. Never infer a slug, expand a shortener, or make a request. */
export function normalizeProfileUrl(value: string): string | undefined {
  if (typeof value !== "string") return undefined;
  let current = value.trim().replace(/&amp;/gi, "&");
  if (!current || current.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(current)) return undefined;
  if (!/^https?:\/\//i.test(current)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(current) || current.startsWith("//")) return undefined;
    const host = current.split(/[/?#]/, 1)[0].toLowerCase();
    if (!BARE_DOMAINS.some((domain) => hostMatches(host, domain))) return undefined;
    current = `https://${current}`;
  }
  const visited = new Set<string>();
  for (let depth = 0; depth <= 3; depth++) {
    if (!isSafePublicProfileUrl(current) || visited.has(current)) return undefined;
    visited.add(current);
    const url = new URL(current);
    if ([...url.searchParams.keys()].some((key) => /^(?:access_token|auth|authorization|api[_-]?key|password|session|sessionid|token)$/i.test(key))) return undefined;
    let fragment: string;
    try { fragment = decodeURIComponent(url.hash); } catch { return undefined; }
    if (/(?:^#|[&?/])(?:access_token|auth|authorization|api[_-]?key|password|session|sessionid|token)=/i.test(fragment)) return undefined;
    const host = url.hostname.toLowerCase();
    const key = ((host === "l.instagram.com" && /^\/(?:l(?:\.php)?)?\/?$/.test(url.pathname)) || (["l.facebook.com", "lm.facebook.com"].includes(host) && /^\/l\.php\/?$/.test(url.pathname))) ? "u"
      : ["www.google.com", "google.com"].includes(host) && url.pathname === "/url" ? (url.searchParams.has("url") ? "url" : "q")
        : ["www.youtube.com", "youtube.com"].includes(host) && url.pathname === "/redirect" ? "q" : undefined;
    if (!key) return url.href;
    const destinations = url.searchParams.getAll(key);
    if (depth === 3 || destinations.length !== 1 || !/^https?:\/\//i.test(destinations[0])) return undefined;
    current = destinations[0];
  }
  return undefined;
}

/** Bounded lexical extraction. Callers still decide whether the surrounding text belongs to this person. */
export function extractProfileUrls(text: string): string[] {
  const values: string[] = [];
  const pattern = /https?:\/\/[^\s<>"'`]+|(?:[a-z0-9-]+\.)+(?:com|site|ee|net)(?:[/?#][^\s<>"'`]*)?/gi;
  for (const match of text.slice(0, 100000).matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index && /[a-z0-9@._/-]/i.test(text[index - 1])) continue;
    const raw = match[0].replace(/[.,;!?)\]}]+$/, "");
    const url = normalizeProfileUrl(raw);
    if (url && !values.includes(url)) values.push(url);
    if (values.length >= 64) break;
  }
  return values;
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}
function trimmed(value?: string): string | undefined { return typeof value === "string" ? value.trim() || undefined : undefined; }
function identityKey(value: string): string { return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); }
function object(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }

/** A profile handle is identity; a post, tagged page, or somebody else's pasted bio is context. */
export function candidateInstagramUrl(value?: string): string | undefined {
  const raw = trimmed(value);
  if (!raw) return undefined;
  if (/^@?[a-z0-9._]{1,30}$/i.test(raw) && !raw.includes("instagram.com")) return `https://www.instagram.com/${raw.replace(/^@/, "")}/`;
  const normalized = normalizeProfileUrl(raw);
  if (!normalized) return undefined;
  const parsed = new URL(normalized);
  if (!["instagram.com", "www.instagram.com"].includes(parsed.hostname.toLowerCase())) return undefined;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1 || !/^[a-z0-9._]{1,30}$/i.test(segments[0])) return undefined;
  if (/^(p|reels?|tv|stories|explore|accounts|about|directory|developer|legal|policies)$/i.test(segments[0])) return undefined;
  return normalized;
}
function instagramIdentity(value: string): string { return new URL(value).pathname.replace(/\//g, "").toLowerCase(); }
const FACT_FIELDS: ProfileFactField[] = ["providerName", "businessName", "city", "state", "postalCode", "providerId", "businessId"];
const FACT_ALIASES: Record<ProfileFactField, string[]> = {
  providerName: ["displayName", "fullName", "full_name", "operatorName", "techName", "name"],
  businessName: ["businessName", "salonName", "parentContainerName", "containerName"],
  city: ["city", "locationCity"], state: ["state", "locationState"], postalCode: ["postalCode", "postal_code", "zip", "zipCode"],
  providerId: ["providerId", "serviceProviderId", "staffId", "employeeId"], businessId: ["businessId"],
};
const LINK_FIELDS = new Set(["bookingurl", "booking", "bookinglink", "schedulerurl", "websiteurl", "website", "site", "listingurl", "profileurl", "detailurl", "sourceurl", "url", "href", "externalurl", "external_url", "external_urls", "externalurls", "biolinks", "bio_links", "links", "urls", "link", "instagram", "instagramurl", "instagramprofileurl", "instagramhandle", "ig", "facebookurl", "tiktokurl", "linktreeurl", "bookingurls", "bookinglinks", "websitelinks", "sociallinks", "externallink", "externallinks", "linkinbio", "biourl"]);
const CONTAINERS = new Set(["profile", "candidate", "provider", "contact", "identity", "social", "socials", "booking", "links", "website", "bio_links", "biolinks", "external_urls", "externalurls", "bio", "biography", "location", "address", "raw", "sourcerecord", "external", "externallinks", "bookinglinks", "websitelinks", "sociallinks", "biolinks", "externalurls"]);
export function reportedBookingPlatform(value: string): Exclude<BookingPlatform, "unknown"> | undefined {
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  return ({ vagaro: "vagaro", glossgenius: "glossgenius", booksy: "booksy", fresha: "fresha", square: "square", squareappointments: "square", styleseat: "styleseat" } as const)[key as "vagaro"];
}
function platformMentions(value: string): RegExpMatchArray[] {
  // Domain strings are handled as URL evidence with their own attribution, never as a second text hint.
  const text = value.replace(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, " ");
  return [...text.matchAll(/\b(?:Vagaro|Gloss\s*Genius|Booksy|Fresha|Square(?:\s+Appointments)?|Style\s*Seat)\b/gi)];
}
const TEXT_FIELDS = new Set(["bio", "biography", "biotext", "bio_text", "description", "caption", "captionsnippet", "rawtext", "raw_text", "text"]);

/** Pure source recovery: all eligible aliases, never an intake-wide or another person's fallback. */
export function recoverCandidateProfile(candidate: ParsedCandidateRow): CandidateProfile {
  const reasons: string[] = [];
  const links: ProfileLink[] = [];
  const fieldEvidence: ProfileFieldEvidence[] = [];
  const platformEvidence: ProfilePlatformEvidence[] = [];
  const sourceRef = JSON.stringify([candidate.intakeId, candidate.id]);
  let raw: Record<string, unknown> = {};
  let structured = false;
  try { const parsed = object(JSON.parse(candidate.rawBlock)); structured = true; if (parsed) raw = parsed; } catch { /* Candidate-scoped text is handled conservatively below. */ }
  const rawName = stringField(raw, FACT_ALIASES.providerName);
  const candidateOwner = candidateInstagramUrl(candidate.instagramHandle) || candidateInstagramUrl(candidate.instagramProfileUrl);
  const expectedHandle = candidateOwner ? instagramIdentity(candidateOwner) : undefined;
  const recordOwner = (record: Record<string, unknown>) => candidateInstagramUrl(stringField(record, ["username", "handle", "ownerUsername", "owner_username", "instagramHandle", "instagram_handle"]));
  const rawOwner = recordOwner(raw);
  const foreignRaw = (!!rawName && identityKey(rawName) !== identityKey(candidate.displayName)) || (!!expectedHandle && !!rawOwner && instagramIdentity(rawOwner) !== expectedHandle);
  const foreignMention = (value: string) => [...value.matchAll(/(?:^|\s)@([a-z0-9._]{1,30})\b/gi)].some((match) => match[1].toLowerCase() !== expectedHandle);
  if (foreignRaw) { raw = {}; reasons.push("conflicting_raw_candidate_identity"); }
  const directory = raw.sourceNote === "vagaro_directory_results" || raw.pageClassification === "directory_results_page" || candidate.parseWarnings?.includes("vagaro_directory_results");
  const sourceContextUrl = normalizeProfileUrl(candidate.sourceContextUrl || "") || (directory ? normalizeProfileUrl(stringField(raw, ["sourceUrl"]) || "") : undefined);
  const sourceUrl = sourceContextUrl || normalizeProfileUrl(candidate.sourceUrl || "") || normalizeProfileUrl(stringField(raw, ["sourceUrl", "profileUrl", "listingUrl"]) || "");
  const basis: ProfileLink["basis"] = directory ? "directory_card" : "submitted";
  const evidenceLinks = (candidate as ParsedCandidateRow & { sourceEvidenceLinks?: Array<{ url: string; sourceUrl?: string; sourcePostId?: string; attribution: "provider" | "business" | "unknown"; evidenceType: string }> }).sourceEvidenceLinks || [];
  const metadataUnresolved = new Set(evidenceLinks.filter((evidence) => evidence && !(/^(owned_profile|owned_post)$/.test(evidence.evidenceType) && evidence.attribution !== "unknown")).map((evidence) => normalizeProfileUrl(evidence.url)).filter(Boolean));
  const metadataOwned = new Set(evidenceLinks.filter((evidence) => evidence && /^(owned_profile|owned_post)$/.test(evidence.evidenceType) && evidence.attribution !== "unknown").map((evidence) => normalizeProfileUrl(evidence.url)).filter(Boolean));
  const providerOwned = candidate.signalType === "provider" || raw.signalType === "provider" || raw.evidenceType === "owned_profile" || raw.evidenceType === "owned_post";
  const weakContext = candidate.signalType === "client_tagged" || raw.signalType === "client_tagged" || /^(?:client_post|mention|comment|tagged)$/.test(String(raw.evidenceType || ""));
  const add = (input: string, sourceField: string, attribution: ProfileLink["attribution"] = "candidate", origin = sourceUrl, specificRef = sourceRef, socialHandle = false) => {
    if (links.length >= 256) { reasons.push("candidate_source_link_limit_reached"); return; }
    const observed = socialHandle ? candidateInstagramUrl(input) : input;
    const classified = observed ? classifyProfileUrl(observed) : null;
    if (!classified) { if (input.trim()) reasons.push("unsafe_source_url_omitted"); return; }
    const parsed = new URL(classified.url);
    const instagram = hostMatches(parsed.hostname, "instagram.com");
    const profileOnly = instagram ? candidateInstagramUrl(classified.url) : classified.url;
    if (!sourceField.startsWith("sourceEvidenceLinks[") && metadataUnresolved.has(classified.url) && !metadataOwned.has(classified.url)) attribution = "unresolved";
    const assigned = attribution === "unresolved" || classified.kind === "directory" || (instagram && !profileOnly) ? "unresolved"
      : classified.kind === "shared_business" ? "business" : attribution;
    links.push({ ...classified, purpose: /(?:booking|scheduler)/i.test(sourceField) ? "booking" : undefined, attribution: assigned, sourceUrl: normalizeProfileUrl(origin || "") || classified.url, basis, sourceRef: specificRef, sourceField, ...(classified.url !== input ? { observedUrl: input } : {}) });
  };
  for (const field of FACT_FIELDS) {
    const key = field === "providerName" ? "displayName" : field;
    const value = trimmed(candidate[key as keyof ParsedCandidateRow] as string | undefined);
    if (value) fieldEvidence.push({ field, value, sourceUrl, sourceRef, sourceField: key, basis, priority: 100 });
  }
  for (const key of ["bookingUrl", "sourceUrl", "websiteUrl", "instagramProfileUrl", "instagramHandle"] as const) {
    const value = trimmed(candidate[key]);
    if (value) add(value, key, weakContext ? "unresolved" : "candidate", sourceUrl, sourceRef, key === "instagramHandle");
  }
  let visited = 0;
  const walk = (record: Record<string, unknown>, path: string, depth: number, inherited: ProfileLink["attribution"]) => {
    if (depth > 6 || visited++ > 80) return;
    if (inherited !== "unresolved" && record.attribution === "business") inherited = "business";
    if (["unresolved", "unknown"].includes(String(record.attribution)) || /^(?:client_post|mention|comment|tagged)$/.test(String(record.evidenceType || ""))) inherited = "unresolved";
    const recordName = stringField(record, depth === 0 || /\.(?:profile|candidate|provider|identity|raw|sourceRecord|source_record)$/.test(path) ? FACT_ALIASES.providerName : FACT_ALIASES.providerName.filter((key) => key !== "name"));
    const owner = recordOwner(record);
    if (depth > 0 && ((recordName && identityKey(recordName) !== identityKey(candidate.displayName)) || (expectedHandle && owner && instagramIdentity(owner) !== expectedHandle))) { reasons.push("conflicting_raw_candidate_identity"); return; }
    for (const field of FACT_FIELDS) for (const key of FACT_ALIASES[field]) {
      if (field === "providerName" && depth > 0 && key === "name" && !/\.(?:profile|candidate|provider|identity|raw|sourceRecord|source_record)$/.test(path)) continue;
      const value = trimmed(typeof record[key] === "string" ? record[key] as string : undefined);
      if (value) fieldEvidence.push({ field, value, sourceUrl, sourceRef, sourceField: `${path}.${key}`, basis, priority: 80 - depth });
    }
    for (const [key, value] of Object.entries(record).slice(0, 100)) {
      const lower = key.toLowerCase().replace(/[_-]/g, "");
      const next = `${path}.${key}`;
      if (typeof value === "string") {
        if (/^(?:platform|bookingplatform|booking_platform|bookingprovider|booking_provider)$/.test(lower)) {
          const platform = reportedBookingPlatform(value);
          if (platform) platformEvidence.push({ platform, evidence: "source_reported", attribution: inherited, sourceUrl, sourceRef, sourceField: next, value });
        }
        if (TEXT_FIELDS.has(lower)) {
          const bio = /^(bio|biography|biotext|bio_text)$/.test(lower);
          const attributed = inherited !== "unresolved" && !weakContext && !foreignMention(value) && (bio || providerOwned);
          for (const url of extractProfileUrls(value)) add(url, next, attributed ? inherited : "unresolved");
          if (attributed) for (const match of platformMentions(value)) {
            const platform = reportedBookingPlatform(match[0]);
            if (platform) platformEvidence.push({ platform, evidence: "source_reported", attribution: inherited, sourceUrl, sourceRef, sourceField: next, value: match[0] });
          }
        } else if (LINK_FIELDS.has(lower) && !(directory && lower === "sourceurl")) add(value, next, inherited, sourceUrl, sourceRef, /^(instagram|instagramhandle|ig)$/.test(lower));
      } else if (CONTAINERS.has(lower) || LINK_FIELDS.has(lower)) {
        const values = Array.isArray(value) ? value.slice(0, 64) : [value];
        for (let index = 0; index < values.length; index++) {
          const child = values[index];
          const childPath = Array.isArray(value) ? `${next}[${index}]` : next;
          if (typeof child === "string" && LINK_FIELDS.has(lower)) add(child, childPath, inherited);
          else { const childObject = object(child); if (childObject) walk(childObject, childPath, depth + 1, inherited); }
        }
      }
    }
  };
  walk(raw, "rawBlock", 0, weakContext ? "unresolved" : "candidate");
  if (candidate.captionSnippet) for (const url of extractProfileUrls(candidate.captionSnippet)) add(url, "captionSnippet", providerOwned && !weakContext && !foreignMention(candidate.captionSnippet) ? "candidate" : "unresolved");
  if (!structured && !foreignRaw && !evidenceLinks.length) {
    const text = candidate.rawBlock || "";
    const named = /^\s*(?:name|provider|display\s*name)\s*:\s*([^\n|]+)/im.exec(text)?.[1];
    const eligibleText = !named || identityKey(named) === identityKey(candidate.displayName);
    const ownerUrl = candidateInstagramUrl(candidate.instagramHandle) || candidateInstagramUrl(candidate.instagramProfileUrl);
    const ownerHandle = ownerUrl ? instagramIdentity(ownerUrl) : undefined;
    let foreignBlock = false;
    if (eligibleText) for (const line of text.split(/\r?\n/).slice(0, 250)) {
      const headingHandle = /^\s*@([a-z0-9._]{1,30})\s*$/i.exec(line)?.[1].toLowerCase();
      if (headingHandle) foreignBlock = !ownerHandle || headingHandle !== ownerHandle;
      if (foreignBlock) continue;
      const mentionedHandles = [...line.matchAll(/(?:^|\s)@([a-z0-9._]{1,30})\b/gi)].map((match) => match[1].toLowerCase());
      if (mentionedHandles.some((handle) => handle !== ownerHandle)) continue;
      const explicit = /^\s*(?:booking(?:\s*(?:url|link))?|website|external\s*(?:url|link)|bio|biography)\s*:/i.test(line);
      if (explicit || providerOwned) {
        for (const url of extractProfileUrls(line)) add(url, "rawBlock.text", !weakContext ? "candidate" : "unresolved");
        if (!weakContext) for (const match of platformMentions(line)) {
          const platform = reportedBookingPlatform(match[0]);
          if (platform) platformEvidence.push({ platform, evidence: "source_reported", attribution: "candidate", sourceUrl, sourceRef, sourceField: "rawBlock.text", value: match[0] });
        }
      }
    }
    else reasons.push("conflicting_raw_candidate_identity");
  }
  if (providerOwned && !weakContext) {
    for (const [field, text] of [["captionSnippet", candidate.captionSnippet || ""]]) {
      if (foreignMention(text)) continue;
      for (const match of platformMentions(text)) {
        const platform = reportedBookingPlatform(match[0]);
        if (platform) platformEvidence.push({ platform, evidence: "source_reported", attribution: "candidate", sourceUrl, sourceRef, sourceField: field, value: match[0] });
      }
    }
  }

  for (let index = 0; index < evidenceLinks.length; index++) {
    const evidence = evidenceLinks[index];
    if (!evidence || typeof evidence.url !== "string") continue;
    const owned = /^(owned_profile|owned_post)$/.test(evidence.evidenceType);
    const attribution = owned && evidence.attribution === "provider" ? "candidate" : owned && evidence.attribution === "business" ? "business" : "unresolved";
    add(evidence.url, `sourceEvidenceLinks[${index}]`, attribution, evidence.sourceUrl || sourceUrl, evidence.sourcePostId ? `${sourceRef}:post:${evidence.sourcePostId}` : sourceRef);
  }
  if (directory && sourceContextUrl && !links.some((link) => link.platform !== "unknown")) add(sourceContextUrl, "sourceContextUrl", "unresolved");
  const value = (field: ProfileFactField) => fieldEvidence.find((claim) => claim.field === field)?.value;
  return reconcileProfile({
    schemaVersion: 1, providerName: candidate.displayName, platform: "unknown", platformLabel: "Unknown", candidateRef: sourceRef, fieldEvidence, platformEvidence,
    businessName: value("businessName"), city: value("city"), state: value("state"), postalCode: value("postalCode"), providerId: value("providerId"), businessId: value("businessId"),
    bookingLinks: [], socialLinks: [], websiteLinks: [], sourceContextUrl, status: directory ? "directory_linked" : "not_checked", reasons, observations: [], searchStatus: "not_needed",
    freshness: links.length || fieldEvidence.some((field) => field.field !== "providerName") ? "source_reported" : "unknown",
  }, links);
}

/** One normalization pass for recovered, cached, and newly discovered facts. It never verifies a person. */
export function reconcileProfile(profile: CandidateProfile, addedLinks: ProfileLink[] = []): CandidateProfile {
  const reasons = [...(profile.reasons || [])].filter((reason) => !["multiple_booking_platforms", "no_candidate_booking_link", "shared_business_page_requires_provider_match", "source_reported_provider_link_not_live_verified", "platform_hint_conflict"].includes(reason));
  const links: ProfileLink[] = [];
  const seen = new Set<string>();
  for (const raw of [...(profile.bookingLinks || []).map((link) => ({ ...link, purpose: link.purpose || "booking" as const })), ...(profile.socialLinks || []), ...(profile.websiteLinks || []), ...addedLinks]) {
    if (!raw || typeof raw.url !== "string") continue;
    const classified = classifyProfileUrl(raw.url);
    if (!classified) { reasons.push("unsafe_source_url_omitted"); continue; }
    const attribution = ["candidate", "business", "unresolved"].includes(raw.attribution) ? raw.attribution : "unresolved";
    const sourceUrl = normalizeProfileUrl(raw.sourceUrl || "") || classified.url;
    const link: ProfileLink = { ...raw, ...classified, purpose: classified.platform !== "unknown" ? "booking" : raw.purpose, kind: classified.platform !== "unknown" ? classified.kind === "unknown" && raw.kind === "individual" ? "individual" : classified.kind : classified.kind,
      attribution: classified.kind === "directory" ? "unresolved" : attribution, sourceUrl, basis: ["submitted", "directory_card", "linked_page"].includes(raw.basis) ? raw.basis : "submitted",
      ...(classified.url !== raw.url && !raw.observedUrl ? { observedUrl: raw.url } : {}) };
    // Old stored social post URLs remain evidence, but never claim a personal account.
    if (hostMatches(new URL(link.url).hostname, "instagram.com") && !candidateInstagramUrl(link.url)) link.attribution = "unresolved";
    const key = JSON.stringify([link.url, link.attribution, link.sourceUrl, link.sourceRef || "", link.sourceField || "", link.basis, link.purpose || ""]);
    if (!seen.has(key)) { seen.add(key); links.push(link); }
  }
  const instagram = links.filter((link) => link.kind === "social" && link.attribution === "candidate" && candidateInstagramUrl(link.url));
  if (new Set(instagram.map((link) => instagramIdentity(link.url))).size > 1) {
    reasons.push("conflicting_instagram_identity");
    for (const link of instagram) link.attribution = "unresolved";
  }
  const bookingLinks = links.filter((link) => link.platform !== "unknown" || (link.purpose === "booking" && link.kind !== "social"));
  const socialLinks = links.filter((link) => link.platform === "unknown" && link.kind === "social");
  const websiteLinks = links.filter((link) => link.platform === "unknown" && link.kind !== "social" && link.purpose !== "booking");
  const platformEvidence: ProfilePlatformEvidence[] = (profile.platformEvidence || []).filter((claim) => claim.evidence === "source_reported" && claim.platform !== undefined && claim.platform in PLATFORM_LABELS && claim.platform !== ("unknown" as string)).map((claim) => ({ ...claim }));
  for (const link of bookingLinks.filter((link) => link.platform && link.platform !== "unknown")) platformEvidence.push({ platform: link.platform as Exclude<BookingPlatform, "unknown">, evidence: "url_domain", attribution: link.attribution, sourceUrl: link.sourceUrl, sourceRef: link.sourceRef, sourceField: link.sourceField, value: link.url });
  // Legacy scalar hints survive only as explicitly source-reported evidence, not fabricated URLs.
  if (!platformEvidence.length && profile.platform && profile.platform !== "unknown") platformEvidence.push({ platform: profile.platform, evidence: "source_reported", attribution: "unresolved", sourceRef: profile.candidateRef, sourceField: "profile.platform", value: profile.platform });
  const uniquePlatformEvidence = platformEvidence.filter((claim, index, all) => all.findIndex((other) => JSON.stringify(other) === JSON.stringify(claim)) === index);
  const observedPlatforms = [...new Set(uniquePlatformEvidence.map((claim) => claim.platform))].sort((a, b) => PLATFORM_LABELS[a].localeCompare(PLATFORM_LABELS[b]));
  const reportedPlatforms = [...new Set(uniquePlatformEvidence.filter((claim) => claim.attribution !== "unresolved").map((claim) => claim.platform))];
  const domainPlatforms = [...new Set(bookingLinks.filter((link) => link.attribution !== "unresolved" && link.platform && link.platform !== "unknown").map((link) => link.platform!))];
  const knownPlatforms = (domainPlatforms.length ? domainPlatforms : reportedPlatforms).sort((a, b) => PLATFORM_LABELS[a].localeCompare(PLATFORM_LABELS[b]));
  const platform = knownPlatforms.length === 1 ? knownPlatforms[0] : "unknown";
  if (domainPlatforms.length && reportedPlatforms.some((reported) => !domainPlatforms.includes(reported))) reasons.push("platform_hint_conflict");
  const platformSummary = knownPlatforms.length === 0 ? "unknown" : knownPlatforms.length === 1 ? "single" : "multiple";
  if (knownPlatforms.length > 1) reasons.push("multiple_booking_platforms");
  const hasShared = bookingLinks.some((link) => link.kind === "shared_business" && link.attribution !== "unresolved");
  const hasIndividual = bookingLinks.some((link) => link.kind === "individual" && link.attribution === "candidate");
  if (hasShared) reasons.push("shared_business_page_requires_provider_match");
  if (hasIndividual && profile.status !== "provider_matched") reasons.push("source_reported_provider_link_not_live_verified");
  if (!bookingLinks.length) reasons.push("no_candidate_booking_link");
  const identityConflict = reasons.some((reason) => reason.startsWith("conflicting_"));
  let status = profile.status || "not_checked";
  if (identityConflict || (knownPlatforms.length > 1 && profile.status !== "provider_matched")) status = "ambiguous";
  else if (["not_checked", "directory_linked", "shared_page_only"].includes(status)) status = hasShared && !hasIndividual ? "shared_page_only" : bookingLinks.length ? "directory_linked" : "not_checked";
  const preferred = bookingLinks.find((link) => link.kind === "individual" && link.attribution === "candidate") || bookingLinks.find((link) => link.attribution === "business");
  const fieldEvidence = [...(profile.fieldEvidence || [])].filter((claim) => FACT_FIELDS.includes(claim.field) && typeof claim.value === "string" && claim.value.trim()).map((claim) => ({ ...claim }));
  for (const field of FACT_FIELDS) if (profile[field] && !fieldEvidence.some((claim) => claim.field === field && claim.value === profile[field])) fieldEvidence.unshift({ field, value: profile[field]!, sourceRef: profile.candidateRef, sourceUrl: profile.sourceContextUrl, sourceField: `profile.${field}`, basis: "submitted" });
  return { ...profile, sourceContextUrl: normalizeProfileUrl(profile.sourceContextUrl || ""), schemaVersion: 1, factRecoveryVersion: PROFILE_FACT_RECOVERY_VERSION, platform, platformLabel: knownPlatforms.length ? knownPlatforms.map((value) => PLATFORM_LABELS[value]).join(" + ") : "Unknown", knownPlatforms, observedPlatforms, platformSummary, platformEvidence: uniquePlatformEvidence,
    providerId: profile.providerId || (knownPlatforms.length === 1 ? preferred?.providerId : undefined), businessId: profile.businessId || (knownPlatforms.length === 1 ? preferred?.businessId : undefined),
    bookingLinks, socialLinks, websiteLinks, status, reasons: [...new Set(reasons)], fieldEvidence: fieldEvidence.filter((claim, index, all) => all.findIndex((other) => JSON.stringify(other) === JSON.stringify(claim)) === index), observations: (profile.observations || []).map((observation) => ({ ...observation, claims: (observation.claims || []).map((claim) => ({ ...claim })) })) };
}

/** Base fields win; later profiles fill gaps and retain every independent source assertion. No person merge. */
export function reconcileCandidateProfile(base: ParsedCandidateRow | CandidateProfile, ...additional: Array<CandidateProfile | ProfileLink[]>): CandidateProfile {
  let result = "rawBlock" in base ? recoverCandidateProfile(base) : reconcileProfile(base);
  for (const evidence of additional) {
    if (Array.isArray(evidence)) { result = reconcileProfile(result, evidence); continue; }
    if (!evidence) continue;
    if (result.candidateRef && evidence.candidateRef && result.candidateRef !== evidence.candidateRef) {
      result = reconcileProfile({ ...result, reasons: [...result.reasons, "conflicting_additional_profile_identity"] });
      continue;
    }
    if (result.providerName && evidence.providerName && identityKey(result.providerName) !== identityKey(evidence.providerName)) {
      if (result.candidateRef && result.candidateRef === evidence.candidateRef) {
        // Same persisted record, changed identity: keep history discoverable without transferring ownership or verification.
        const history = [...(evidence.bookingLinks || []), ...(evidence.socialLinks || []), ...(evidence.websiteLinks || [])].map((link) => ({ ...link, attribution: "unresolved" as const }));
        result = reconcileProfile({ ...result, lastAttemptAt: result.lastAttemptAt || evidence.lastAttemptAt, lastSuccessfulAt: result.lastSuccessfulAt || evidence.lastSuccessfulAt, freshness: "stale", observations: [...result.observations, ...(evidence.observations || [])],
          fieldEvidence: [...(result.fieldEvidence || []), ...(evidence.fieldEvidence || []).map((claim) => ({ ...claim, priority: 0 }))],
          platformEvidence: [...(result.platformEvidence || []), ...(evidence.platformEvidence || []).map((claim) => ({ ...claim, attribution: "unresolved" as const }))],
          reasons: [...result.reasons, "conflicting_historical_profile_identity"] }, history);
      } else result = reconcileProfile({ ...result, reasons: [...result.reasons, "conflicting_additional_profile_identity"] });
      continue;
    }
    const fields: Partial<CandidateProfile> = {};
    for (const field of FACT_FIELDS) if (!result[field] && evidence[field]) fields[field] = evidence[field];
    const observations = [...result.observations];
    const observed = new Set(observations.map((observation) => JSON.stringify(observation)));
    for (const observation of evidence.observations || []) if (!observed.has(JSON.stringify(observation))) observations.push(observation);
    result = reconcileProfile({ ...result, ...fields, candidateRef: result.candidateRef || evidence.candidateRef, lastAttemptAt: result.lastAttemptAt || evidence.lastAttemptAt, lastSuccessfulAt: result.lastSuccessfulAt || evidence.lastSuccessfulAt, freshness: result.freshness === "unknown" && evidence.freshness ? evidence.freshness === "current_check" ? "source_reported" : evidence.freshness : result.freshness, fieldEvidence: [...(result.fieldEvidence || []), ...(evidence.fieldEvidence || [])], platformEvidence: [...(result.platformEvidence || []), ...(evidence.platformEvidence || [])], observations,
      reasons: [...result.reasons, ...(evidence.reasons || [])] }, [...(evidence.bookingLinks || []), ...(evidence.socialLinks || []), ...(evidence.websiteLinks || [])]);
  }
  return result;
}
