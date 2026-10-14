import { candidateInstagramUrl, classifyProfileUrl } from "@/lib/admin/pipeline/profile-model";
import type { CandidateProfile, ProfileLink, ProfilePlatformEvidence } from "@/lib/admin/pipeline/profile-types";
import type { CatalogFactClaim } from "./types";
import type { SourceDocument, CatalogSources } from "./projection";
import type { ParsedCandidateRow } from "@/lib/source-intake/types";

const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value) ? value.map(str).filter(Boolean) : [];
const identity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const links = (profile: CandidateProfile) => [...profile.bookingLinks, ...profile.socialLinks, ...profile.websiteLinks];

function surfaceUrl(type: string, value: string): string | undefined {
  if (type === "instagram" || type === "instagram_handle") return candidateInstagramUrl(value);
  if ((type === "tiktok" || type === "tiktok_handle") && /^@?[a-z0-9._]{1,30}$/i.test(value)) return `https://www.tiktok.com/@${value.replace(/^@/, "")}`;
  return classifyProfileUrl(value) ? value : undefined;
}
function matchingLink(profile: CandidateProfile, url: string) {
  const key = (value: string) => { try { const parsed = new URL(value); return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`; } catch { return value; } };
  return links(profile).find((link) => link.attribution !== "unresolved" && key(link.url) === key(url));
}
function makeLink(url: string, attribution: ProfileLink["attribution"], sourceRef: string, sourceField: string, sourceUrl: string, observedAt: string): ProfileLink | null {
  const classified = classifyProfileUrl(url);
  if (!classified) return null;
  return { ...classified, attribution: classified.kind === "directory" ? "unresolved" : attribution, basis: "submitted", sourceRef, sourceField, sourceUrl: classifyProfileUrl(sourceUrl)?.url || url, observedAt: observedAt || undefined };
}
function claim(doc: SourceDocument, collection: string, field: string, value: unknown, kind: string, attribution: ProfileLink["attribution"], status: CatalogFactClaim["status"], extra: Partial<CatalogFactClaim> = {}): CatalogFactClaim {
  return { id: `claim:${collection}:${doc.id}:${field}`, sourceRef: { collection, id: doc.id, role: "source" }, sourceField: field, kind, value: typeof value === "string" ? value : JSON.stringify(value), attribution, status, observedAt: str(doc.data.observedAt) || str(doc.data.resolvedAt) || doc.updatedAt, raw: value, ...extra };
}

/** Lane results are claims attached by exact source IDs. Review approval is never identity verification. */
export function adaptCandidateEvidence(profile: CandidateProfile, candidateName: string, results: Array<SourceDocument & { lane: string; collection: string }>, staged: SourceDocument[]) {
  const recoveredLinks: ProfileLink[] = [];
  const factClaims: CatalogFactClaim[] = [];
  const conflicts: string[] = [];
  for (const result of results) {
    const data = result.data, sourceRef = `${result.collection}:${result.id}`;
    if (result.lane === "SOCIAL") {
      const surfaces = Array.isArray(data.discoveredSurfaces) ? data.discoveredSurfaces : [];
      surfaces.forEach((raw, index) => {
        const surface = obj(raw), value = str(surface.value), type = str(surface.type), reasons = strings(surface.reasons);
        const url = surfaceUrl(type, value), existing = url ? matchingLink(profile, url) : undefined;
        // Search title/name similarity and confidence do not establish ownership. A source marker is a claim, not a live check.
        const searchOnly = reasons.some((reason) => /search_discovery|search title|query=/i.test(reason));
        const sourceReported = reasons.some((reason) => reason === "candidate_source_reported_link_not_fetched_or_identity_verified");
        const rejected = data.finalStatus === "rejected";
        const classified = url ? classifyProfileUrl(url) : null;
        const attribution: ProfileLink["attribution"] = rejected || searchOnly ? "unresolved" : existing?.attribution || (sourceReported ? (reasons.includes("shared_business_link_not_provider_identity") || classified?.kind === "shared_business" ? "business" : "candidate") : "unresolved");
        const field = `discoveredSurfaces[${index}]`;
        factClaims.push(claim(result, result.collection, field, raw, type || "social_discovery", attribution, rejected ? "rejected" : attribution === "unresolved" ? "discovered" : "source_reported", { value, raw, sourceUrl: url, confidence: str(surface.confidence), reasons, reviewStatus: str(data.finalStatus) || undefined, evidenceIds: strings(data.evidenceIds) }));
        const link = url ? makeLink(url, attribution, sourceRef, field, str(surface.sourceUrl) || url, str(data.resolvedAt)) : null;
        if (link) recoveredLinks.push(link);
      });
    } else {
      const identityConflict = str(data.matchedLicenseName) && identity(candidateName) !== identity(str(data.matchedLicenseName));
      if (identityConflict) conflicts.push("dora_license_name_requires_identity_review");
      for (const field of ["matchedLicenseName", "matchedLicenseNumber", "licenseType", "licenseStatusText", "city", "state", "status", "score", "reasons"]) {
        if (data[field] === undefined || data[field] === "") continue;
        factClaims.push(claim(result, result.collection, field, data[field], `dora_${field}`, "unresolved", data.finalStatus === "rejected" ? "rejected" : "source_reported", { reviewStatus: str(data.finalStatus) || undefined, evidenceIds: strings(data.evidenceIds), reasons: strings(data.reasons) }));
      }
    }
  }
  for (const doc of staged) {
    const data = doc.data, type = str(data.factType), value = str(data.factValue), url = surfaceUrl(type, value);
    const exact = url ? matchingLink(profile, url) || recoveredLinks.find((link) => link.url === url && link.attribution !== "unresolved") : undefined;
    const nameConflict = Boolean(str(data.candidateName) && identity(candidateName) !== identity(str(data.candidateName)));
    if (nameConflict) conflicts.push("staged_evidence_candidate_name_conflict");
    const reasons = strings(data.sourceReasons || data.reasons);
    const searchOnly = reasons.some((reason) => /search_discovery|search title|query=/i.test(reason));
    // Old staging rows omitted attribution. Never turn their confidence/operator suggestion into ownership.
    const explicit = data.attribution === "candidate" || data.attribution === "business" ? data.attribution : undefined;
    const attribution: ProfileLink["attribution"] = nameConflict || searchOnly ? "unresolved" : exact?.attribution || (explicit && data.sourceRef ? explicit : "unresolved");
    factClaims.push(claim(doc, "adminPipelineOperatorEvidence", "factValue", value, type, attribution, attribution === "unresolved" && url ? "discovered" : "source_reported", { sourceUrl: str(data.sourceUrl) || url, confidence: str(data.confidence), reasons, raw: data, evidenceIds: [str(data.id) || doc.id] }));
    if (url && ["booking_url", "website_url", "linktree_url", "instagram_handle", "tiktok_handle"].includes(type)) {
      const link = makeLink(url, attribution, `adminPipelineOperatorEvidence:${doc.id}`, "factValue", str(data.sourceUrl), str(data.observedAt));
      if (link) recoveredLinks.push(link);
    }
  }
  return { links: recoveredLinks, factClaims, conflicts: [...new Set(conflicts)] };
}

/** Only business-owned containers are inspected; staff/member records are never promoted into people. */
export function adaptLegacyBusinessEvidence(doc: SourceDocument) {
  const recoveredLinks: ProfileLink[] = [], factClaims: CatalogFactClaim[] = [];
  const platformEvidence: ProfilePlatformEvidence[] = [];
  const containers = new Set(["premise", "places", "best", "links", "social", "socials", "socialLinks", "social_links", "socialProfiles", "social_profiles", "booking", "bookings", "bookingLinks", "booking_links", "website", "websites", "websiteLinks", "website_links", "online", "onlinePresence", "online_presence", "scheduling", "contact", "contacts", "urls", "profiles", "platforms"]);
  const fields = /^(?:url|href|value|website|websiteUrl|website_url|site|siteUrl|booking|bookingUrl|booking_url|bookingLink|schedulerUrl|schedulingUrl|instagram|instagramUrl|instagram_url|instagramHandle|instagramProfileUrl|ig|tiktok|tiktokUrl|tiktokHandle|facebook|facebookUrl|linktree|linktreeUrl|vagaro|glossgenius|booksy|fresha|square|styleseat|profileUrl|platform|platforms|bookingPlatform|booking_provider|scheduler)$/i;
  function walk(value: unknown, field: string, depth: number, eligible: boolean): void {
    if (depth > 5) return;
    if (typeof value === "string") {
      if (!eligible) return;
      const leaf = field.split(".").at(-1)?.replace(/\[\d+\]$/, "") || "";
      const platformHint = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
      if (/^(platforms?|bookingPlatform|booking_provider|scheduler)$/i.test(leaf) && ["vagaro", "glossgenius", "booksy", "fresha", "square", "styleseat"].includes(platformHint)) {
        platformEvidence.push({ platform: platformHint as ProfilePlatformEvidence["platform"], evidence: "source_reported", attribution: "business", value, sourceRef: `tech_index:${doc.id}`, sourceField: field });
        factClaims.push(claim(doc, "tech_index", field, value, "business_platform", "business", "source_reported"));
      }
      const url = /instagram|^ig$/i.test(leaf) ? candidateInstagramUrl(value) : surfaceUrl(/tiktok/i.test(leaf) ? "tiktok" : "website", value);
      if (!url) return;
      const link = makeLink(url, "business", `tech_index:${doc.id}`, field, url, str(doc.data.updatedAt) || doc.updatedAt || "");
      if (link) recoveredLinks.push(link);
      factClaims.push(claim(doc, "tech_index", field, value, "business_link", "business", "source_reported", { sourceUrl: url }));
      return;
    }
    if (Array.isArray(value)) { value.forEach((entry, index) => walk(entry, `${field}[${index}]`, depth + 1, eligible)); return; }
    for (const [key, entry] of Object.entries(obj(value))) {
      if (/^(?:staff|team|employees|providers|members|people|reviews|results)$/i.test(key)) continue;
      const permitted = fields.test(key) || containers.has(key);
      if (permitted) walk(entry, field ? `${field}.${key}` : key, depth + 1, true);
    }
  }
  walk(doc.data, "", 0, false);
  return { links: recoveredLinks, factClaims, platformEvidence };
}

/** Shared exact-key join for catalog, validation and refinement; never intake-wide fallback. */
export function adaptStoredCandidateEvidence(candidate: ParsedCandidateRow, profile: CandidateProfile, sources: CatalogSources) {
  const matches = (doc: SourceDocument) => Boolean(candidate.intakeId.trim() && candidate.id.trim()) && doc.data.intakeId === candidate.intakeId && doc.data.candidateId === candidate.id;
  const results = ["Dora", "Social"].flatMap((lane) => (sources[`adminPipeline${lane}Results`] || []).filter(matches).map((doc) => ({ ...doc, lane: lane.toUpperCase(), collection: `adminPipeline${lane}Results` })));
  const staged = (sources.adminPipelineOperatorEvidence || []).filter(matches);
  return adaptCandidateEvidence(profile, candidate.displayName, results, staged);
}
