import { detectPlatformFromUrl, extractHandle } from "@/lib/social-targets/social-normalization";
import {
  classifyEvidenceTypeFromUrl,
  createEvidenceItem,
  domainMatch,
  nameSimilarityScore,
} from "@/lib/social-targets/evidence";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";
import { extractDomain } from "@/lib/social-targets/source-adapters/shared";
import type { SocialPlatform } from "@/types/social-target";
import type { DiscoveryAnchor, GoogleQuery } from "@/lib/social-targets/google-discovery/query-generator";
import type { SocialEvidenceItem } from "@/types/social-target";

export type GoogleResult = {
  title: string;
  url: string;
  snippet?: string;
};

function normalizeUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function platformFromResult(url: string, queryType: GoogleQuery["type"]): SocialPlatform {
  const detected = detectPlatformFromUrl(url);
  if (detected !== "unknown") return detected;
  if (queryType === "website_social" || queryType === "phone_lookup" || queryType === "address_lookup") return "website";
  return "unknown";
}

function keyForDedup(input: SourceCandidateInput): string {
  return `${input.platform ?? "unknown"}|${(input.handle ?? "").toLowerCase()}|${(input.profileUrl ?? "").toLowerCase()}`;
}

export function adaptGoogleResultsToSourceCandidates(
  results: GoogleResult[],
  query: GoogleQuery,
  anchor?: DiscoveryAnchor
): SourceCandidateInput[] {
  const dedup = new Set<string>();
  const out: SourceCandidateInput[] = [];
  for (const result of results) {
    const url = normalizeUrl(result.url);
    if (!url) continue;
    const platform = platformFromResult(url, query.type);
    if (platform === "unknown") continue;
    const handle = extractHandle(platform, url);
    const input: SourceCandidateInput = {
      sourceType: "google",
      sourceTrustTier: "tier2",
      sourceLabel: "Google discovery",
      sourceUrl: url,
      businessName: anchor?.name,
      alternateNames: anchor?.nameVariants,
      website: anchor?.website,
      phone: anchor?.phone,
      address: anchor?.address,
      city: anchor?.city,
      zone: anchor?.zone,
      category: anchor?.category,
      platform,
      handle,
      profileUrl: url,
      evidence: [
        `Discovered via Google query: ${query.query}`,
        `Matched platform: ${platform}`,
        ...(result.title ? [`Google title: ${result.title}`] : []),
      ],
      notes: [
        "Google-indexed profile candidate; requires validation",
        ...(query.notes ? [query.notes] : []),
        ...(result.snippet ? [`Snippet: ${result.snippet}`] : []),
      ],
      territoryHint: Boolean(anchor?.city || anchor?.zone),
      liveHint: "unknown",
      rawSourceType: "google_query_result",
    };
    const key = keyForDedup(input);
    if (dedup.has(key)) continue;
    dedup.add(key);
    out.push(input);
  }
  return out;
}

export function adaptGoogleResultsToEvidenceItems(
  results: GoogleResult[],
  query: GoogleQuery,
  anchor: DiscoveryAnchor
): SocialEvidenceItem[] {
  const out: SocialEvidenceItem[] = [];
  const seen = new Set<string>();
  const anchorGeo = `${anchor.city ?? ""} ${anchor.zone ?? ""}`.trim().toLowerCase();
  for (const result of results) {
    const url = normalizeUrl(result.url);
    if (!url) continue;
    const type = classifyEvidenceTypeFromUrl(url);
    const platform = platformFromResult(url, query.type);
    const title = result.title?.trim();
    const snippet = result.snippet?.trim();
    const joinedText = `${title ?? ""} ${snippet ?? ""}`.toLowerCase();
    const nameSimilarity = nameSimilarityScore(anchor.name, title ?? snippet);
    const geoMatch = anchorGeo ? joinedText.includes(anchorGeo) : Boolean(anchor.city || anchor.zone);
    const phoneMatch = Boolean(anchor.phone && joinedText.includes(anchor.phone.replace(/[^\d]/g, "").slice(-7)));
    const domainAligned = domainMatch(anchor.website, url);
    const inferredType =
      query.type === "phone_lookup"
        ? "phone_lookup"
        : query.type === "address_lookup"
          ? "address_lookup"
          : query.type === "website_social"
            ? "website_social"
            : type;
    const confidenceScore =
      nameSimilarity * 0.62 + (geoMatch ? 0.2 : 0) + (domainAligned ? 0.15 : 0) + (phoneMatch ? 0.1 : 0);
    const evidencePlatform =
      platform === "instagram" || platform === "tiktok" || platform === "linktree" || platform === "website"
        ? platform
        : undefined;
    const evidence = createEvidenceItem({
      type: inferredType,
      platform: evidencePlatform,
      url,
      title,
      snippet,
      sourceQuery: query.query,
      confidence: confidenceScore >= 0.78 ? "high" : confidenceScore >= 0.5 ? "medium" : "low",
      nameSimilarity,
      geoMatch,
      phoneMatch,
      domainMatch: domainAligned,
      handle: evidencePlatform ? extractHandle(evidencePlatform, url) : undefined,
      createdAt: new Date().toISOString(),
    });
    const key = `${evidence.type}|${evidence.platform ?? ""}|${extractDomain(evidence.url) ?? ""}|${(evidence.url ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(evidence);
  }
  return out;
}
