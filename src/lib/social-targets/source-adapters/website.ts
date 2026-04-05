import { detectPlatformFromUrl, extractHandle } from "@/lib/social-targets/social-normalization";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters/types";
import {
  asRecord,
  compactEvidence,
  createBaseCandidate,
  extractDomain,
  normalizeUrl,
  pickString,
  pickStringArray,
  stripAt,
} from "@/lib/social-targets/source-adapters/shared";
import type { SocialPlatform } from "@/types/social-target";

function isKnownSocialOrBooking(platform: SocialPlatform): boolean {
  return platform === "instagram" || platform === "tiktok" || platform === "linktree" || platform === "booking";
}

/**
 * Website-derived source can produce multiple normalized candidates:
 * - website/domain candidate
 * - social/booking link candidates
 */
export function adaptWebsiteRecord(raw: unknown): SourceCandidateInput[] {
  const r = asRecord(raw);
  const website = normalizeUrl(pickString(r, ["website", "sourceUrl", "url", "anchor_directory_website_url"]));
  const businessName = pickString(r, ["businessName", "name", "brand", "anchor_directory_brand"]);
  const city = pickString(r, ["city"]);
  const state = pickString(r, ["state"]);
  const zone = pickString(r, ["zone", "zone_id", "zone_name"]);
  const address = pickString(r, ["address"]);
  const category = pickString(r, ["category", "subcategory"]);
  const rawId = pickString(r, ["id", "location_id", "rawSourceId"]);
  const domain = extractDomain(website);
  const inputs: SourceCandidateInput[] = [];

  inputs.push({
    ...createBaseCandidate({
      sourceType: "website",
      sourceTrustTier: "tier2",
      sourceLabel: "Website",
      sourceUrl: website,
      rawSourceId: rawId,
    }),
    businessName,
    website,
    domain,
    address,
    city,
    state,
    zone,
    category,
    platform: "website",
    profileUrl: website,
    anchorHint: Boolean(domain),
    territoryHint: Boolean(city || state || zone),
    rawSourceType: "website_root",
    evidence: compactEvidence([
      domain ? `Website domain: ${domain}` : undefined,
      businessName ? `Website brand text: ${businessName}` : undefined,
      "Website is a strong corroborator source (tier2).",
    ]),
  });

  const linkFields = [
    "instagram_url",
    "anchor_directory_instagram_url",
    "tiktok_url",
    "booking_url",
    "facebook_url",
    "profileUrl",
  ];
  const links = new Set<string>();
  for (const field of linkFields) {
    const value = normalizeUrl(pickString(r, [field]));
    if (value) links.add(value);
  }
  for (const candidate of pickStringArray(r, ["socialLinks", "bookingLinks"]) ?? []) {
    const normalized = normalizeUrl(candidate);
    if (normalized) links.add(normalized);
  }

  for (const link of links) {
    const platform = detectPlatformFromUrl(link);
    if (!isKnownSocialOrBooking(platform)) continue;
    const explicitHandle = stripAt(
      pickString(r, [
        "instagram_handle",
        "anchor_directory_instagram_handle",
        "handle",
      ])
    );
    const derivedHandle = extractHandle(platform, link);
    inputs.push({
      ...createBaseCandidate({
        sourceType: "website",
        sourceTrustTier: "tier2",
        sourceLabel: "Website-linked profile",
        sourceUrl: website ?? link,
        rawSourceId: rawId,
      }),
      businessName,
      city,
      state,
      zone,
      category,
      website,
      domain,
      platform,
      handle: explicitHandle ?? derivedHandle,
      profileUrl: link,
      anchorHint: false,
      territoryHint: Boolean(city || state || zone),
      rawSourceType: "website_link",
      evidence: compactEvidence([
        "Website linked this profile/channel.",
        `${platform.toUpperCase()} candidate from website evidence.`,
      ]),
      notes: ["Website-linked channels still require liveness and identity verification."],
    });
  }

  return inputs;
}

