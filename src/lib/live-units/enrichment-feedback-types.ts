/**
 * Client-side enrichment feedback over existing Live Unit signals (no new fetches).
 */

export type EnrichmentUpgradeReason =
  | "ig_found"
  | "booking_found"
  | "location_confirmed"
  | "identity_strengthened"
  | "operator_linked"
  | "platform_confirmed";

export interface EnrichmentFeedbackResult {
  liveUnitId: string;
  upgraded: boolean;
  oldScore: number;
  newScore: number;
  /** Actual points added after cap (newScore - oldScore). */
  boost: number;
  reasons: EnrichmentUpgradeReason[];
  movedToHighConfidence: boolean;
}
