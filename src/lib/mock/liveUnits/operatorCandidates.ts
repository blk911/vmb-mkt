/**
 * Mock extraction outputs for v1 — keyed by `live_unit_id` (validated business anchor).
 * Replace with persisted/API results when a real extraction pipeline exists.
 */
import type { ExtractedOperatorCandidate } from "@/lib/live-units/operator-extraction-types";

/** Real IDs from `data/markets/beauty_live_units.v1.json` (first rows) for demo. */
export const MOCK_OPERATOR_CANDIDATES_BY_BUSINESS: Record<string, ExtractedOperatorCandidate[]> = {
  /** Tolga Taskin Salon — website team + IG cross-link (Tier A). */
  "93c53bb6b078822a": [
    {
      id: "op_tolga_staff_1",
      businessId: "93c53bb6b078822a",
      businessName: "Tolga Taskin Salon",
      locationLabel: "Denver, CO",
      operatorName: "Tolga Taskin",
      roleLabel: "Owner / Lead Stylist",
      instagramHandle: "tolgataskinhair",
      profileUrl: "https://www.instagram.com/tolgataskinhair",
      sourceTypes: ["website_staff_page", "instagram_cross_link"],
      evidenceSnippets: [
        "Listed on official /team page as owner.",
        "Business IG bio links professional handle; profile references Cherry Creek salon.",
      ],
      confidence: "high",
      isSurfaced: true,
      lastSeenAt: "2026-03-12T12:00:00.000Z",
    },
    {
      id: "op_tolga_staff_2",
      businessId: "93c53bb6b078822a",
      businessName: "Tolga Taskin Salon",
      locationLabel: "Denver, CO",
      operatorName: "Maria Chen",
      roleLabel: "Senior Stylist",
      instagramHandle: null,
      profileUrl: "https://tolgataskinsalons.com/team",
      sourceTypes: ["website_staff_page"],
      evidenceSnippets: ["Named provider on official staff page with role."],
      confidence: "high",
      isSurfaced: true,
      lastSeenAt: "2026-03-12T12:00:00.000Z",
    },
  ],
  /** Angel Glow Artistry — medium-confidence only (should NOT surface in main UI). */
  "56fa72e7f665b609": [
    {
      id: "op_angel_weak_1",
      businessId: "56fa72e7f665b609",
      businessName: "Angel Glow Artistry",
      locationLabel: "Denver, CO",
      operatorName: "unknown_influencer",
      roleLabel: null,
      instagramHandle: "random_creator_den",
      profileUrl: null,
      sourceTypes: ["instagram_business_post"],
      evidenceSnippets: ["Appears in tagged photo without role context."],
      confidence: "medium",
      isSurfaced: false,
      lastSeenAt: "2026-03-12T12:00:00.000Z",
    },
  ],
  /** ALEXANDRIA BANCHONGUHITH — only low / ambiguous (no surface). */
  "a290dceb9522434f": [
    {
      id: "op_alex_low",
      businessId: "a290dceb9522434f",
      businessName: "ALEXANDRIA BANCHONGUHITH",
      locationLabel: "BROOMFIELD, CO",
      operatorName: null,
      roleLabel: null,
      instagramHandle: "suspicious_handle",
      profileUrl: null,
      sourceTypes: ["other"],
      evidenceSnippets: ["Unverified mention in comment thread."],
      confidence: "low",
      isSurfaced: false,
      lastSeenAt: null,
    },
  ],
  /** IG-led high confidence (matches live_unit row name) — explicit role + cross-link. */
  "cdc02d69f50a10f7": [
    {
      id: "op_alisha_ig_high",
      businessId: "cdc02d69f50a10f7",
      businessName: "ALISHA RENEE' MONTGOMERY",
      locationLabel: "BROOMFIELD, CO",
      operatorName: "Alisha Montgomery",
      roleLabel: "Cosmetologist / Hair",
      instagramHandle: "alisharenee.styles",
      profileUrl: "https://www.instagram.com/alisharenee.styles",
      sourceTypes: ["instagram_business_post", "instagram_cross_link", "instagram_business_bio"],
      evidenceSnippets: [
        "Official business post names Alisha as stylist.",
        "Cross-linked IG bio references Broomfield practice; role clear.",
      ],
      confidence: "high",
      isSurfaced: true,
      lastSeenAt: "2026-03-12T12:00:00.000Z",
    },
  ],
};
