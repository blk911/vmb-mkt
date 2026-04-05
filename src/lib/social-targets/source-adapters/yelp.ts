import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters/types";
import {
  asRecord,
  compactEvidence,
  createBaseCandidate,
  extractDomain,
  normalizePhone,
  normalizeUrl,
  pickString,
  pickStringArray,
} from "@/lib/social-targets/source-adapters/shared";

/**
 * Yelp is expansion-oriented (tier3) and should not finalize identity by itself.
 */
export function adaptYelpRecord(raw: unknown): SourceCandidateInput[] {
  const r = asRecord(raw);
  const yelpUrl = normalizeUrl(pickString(r, ["yelp_url", "url", "profileUrl"]));
  const businessName = pickString(r, ["name", "businessName", "title"]);
  const website = normalizeUrl(pickString(r, ["website", "website_url"]));
  const category = pickString(r, ["category", "categories", "serviceCategory"]);
  const address = pickString(r, ["address", "location", "formatted_address"]);
  const city = pickString(r, ["city"]);
  const state = pickString(r, ["state"]);
  const postalCode = pickString(r, ["postalCode", "postal_code", "zip"]);
  const rawId = pickString(r, ["id", "business_id", "slug"]);

  const evidence = compactEvidence([
    businessName ? `Yelp candidate name: ${businessName}` : undefined,
    category ? `Yelp category hint: ${category}` : undefined,
    website ? "Yelp includes website hint" : undefined,
    "Yelp is treated as expansion source only (tier3)",
  ]);

  return [
    {
      ...createBaseCandidate({
        sourceType: "yelp",
        sourceTrustTier: "tier3",
        sourceLabel: "Yelp",
        sourceUrl: yelpUrl,
        rawSourceId: rawId,
      }),
      businessName,
      alternateNames: pickStringArray(r, ["alternateNames", "aliases"]),
      phone: normalizePhone(pickString(r, ["phone", "display_phone"])),
      website,
      domain: extractDomain(website),
      address,
      city,
      state,
      postalCode,
      category,
      anchorHint: false,
      territoryHint: Boolean(city || state),
      rawSourceType: "yelp_business",
      evidence,
      notes: ["Do not promote to identity truth without corroboration."],
    },
  ];
}

