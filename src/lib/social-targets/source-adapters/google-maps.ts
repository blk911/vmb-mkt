import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters/types";
import {
  asRecord,
  compactEvidence,
  createBaseCandidate,
  extractDomain,
  normalizePhone,
  normalizeUrl,
  pickBoolean,
  pickString,
  pickStringArray,
} from "@/lib/social-targets/source-adapters/shared";

/**
 * Google Maps is treated as a tier1 anchor-oriented source.
 * This adapter preserves clues without asserting final identity truth.
 */
export function adaptGoogleMapsRecord(raw: unknown): SourceCandidateInput[] {
  const r = asRecord(raw);
  const businessName = pickString(r, ["name", "businessName", "displayName"]);
  const website = normalizeUrl(pickString(r, ["website", "website_url", "url"]));
  const category = pickString(r, ["category", "primaryType", "category_raw"]);
  const subcategory = pickString(r, ["subcategory", "subtype"]);
  const zone = pickString(r, ["zone", "zone_id", "zone_name"]);
  const address = pickString(r, ["address", "formatted_address"]);
  const city = pickString(r, ["city"]);
  const state = pickString(r, ["state"]);
  const postalCode = pickString(r, ["postalCode", "postal_code", "zip"]);
  const rawId = pickString(r, ["place_id", "top_place_id", "chosen_place_id", "location_id", "id"]);
  const isAnchor = pickBoolean(r, ["is_anchor", "isAnchor"]) ?? true;

  const evidence = compactEvidence([
    businessName ? `Maps listing name: ${businessName}` : undefined,
    address ? `Maps address: ${address}` : undefined,
    category ? `Maps category: ${category}` : undefined,
    website ? "Maps includes website link" : undefined,
    isAnchor ? "Maps row marked as anchor-capable source" : undefined,
  ]);

  return [
    {
      ...createBaseCandidate({
        sourceType: "google_maps",
        sourceTrustTier: "tier1",
        sourceLabel: "Google Maps",
        sourceUrl: website,
        rawSourceId: rawId,
      }),
      businessName,
      alternateNames: pickStringArray(r, ["alternateNames", "aliases"]),
      phone: normalizePhone(pickString(r, ["phone", "formatted_phone_number"])),
      website,
      domain: extractDomain(website),
      address,
      city,
      state,
      postalCode,
      zone,
      category,
      subcategory,
      anchorHint: isAnchor,
      territoryHint: Boolean(city || state || zone),
      rawSourceType: "maps_place",
      evidence,
    },
  ];
}

