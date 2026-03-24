/**
 * Deterministic reason tags + workflow labels for Build Mode rows (uses existing member/live-unit fields only).
 */
import type { EnrichedBeautyZoneMember } from "@/lib/markets";
import type { BuildReasonTag, BuildWorkflowState, DerivedBuildItemState } from "./zone-build-reason-types";

const NEEDS_REVIEW_MIN = 40;
const NEEDS_REVIEW_MAX = 69;

function hasIg(m: Pick<EnrichedBeautyZoneMember, "instagram_url" | "instagram_handle">): boolean {
  return !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
}

function hasBooking(m: Pick<EnrichedBeautyZoneMember, "booking_url" | "booking_provider">): boolean {
  return !!(m.booking_url?.trim() || m.booking_provider?.trim());
}

function pickTags(tags: BuildReasonTag[], max = 4): BuildReasonTag[] {
  const seen = new Set<BuildReasonTag>();
  const out: BuildReasonTag[] = [];
  for (const t of tags) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Salon-like density cue (aligned with zone-build-ops anchor heuristic). */
function isSalonLike(m: EnrichedBeautyZoneMember): boolean {
  const cat = (m.category || "").toLowerCase();
  const cr = (m.category_raw || "").toLowerCase();
  if (["hair", "nail", "esthe", "barber", "spa", "beauty"].includes(cat)) return true;
  if (cr.includes("salon") || cr.includes("barber") || cr.includes("nail") || cr.includes("spa")) return true;
  return false;
}

function techNearbyProxy(m: EnrichedBeautyZoneMember): number {
  const licenses = m.nearby_dora_licenses_total ?? 0;
  const instore = m.nearby_dora_instore_likely_count ?? 0;
  return Math.max(licenses, instore);
}

function hasStorefrontSignal(m: EnrichedBeautyZoneMember): boolean {
  if ((m.subtype || "").toLowerCase() === "storefront") return true;
  if ((m.nearby_dora_instore_likely_count ?? 0) > 0) return true;
  return false;
}

function memberWorkflowState(m: EnrichedBeautyZoneMember): BuildWorkflowState {
  if (m.is_anchor) return "promoted";
  const grayOk = m.gray_resolution_matched === true;
  const pathOk = m.path_enrichment_matched === true;
  if (grayOk || pathOk) return "reviewed";
  if (hasBooking(m) && hasIg(m)) return "bookable";
  return "unreviewed";
}

function nextActionForUnresolved(m: EnrichedBeautyZoneMember, state: BuildWorkflowState): string | null {
  if (state === "promoted") return "In roster as anchor";
  if (state === "reviewed") return "Promote or refine";
  if (m.gray_resolution_matched === false) return "Review first";
  if (!hasIg(m) && !hasBooking(m)) return "Add identity signals";
  return "Review first";
}

/**
 * Why this row is in Unresolved + current position (no external “targeted” signal on members).
 */
export function deriveUnresolvedCandidateState(m: EnrichedBeautyZoneMember): DerivedBuildItemState {
  const tags: BuildReasonTag[] = [];

  if (m.gray_resolution_matched === false) tags.push("resolution_unmatched");
  if (m.path_enrichment_matched === false) tags.push("path_unmatched");
  if (m.upgraded_priority_score >= NEEDS_REVIEW_MIN && m.upgraded_priority_score <= NEEDS_REVIEW_MAX) {
    tags.push("needs_review");
  }
  if (!hasIg(m) && !hasBooking(m)) tags.push("weak_identity");
  if ((m.priority_score ?? 0) < 4) tags.push("low_signal");
  if (tags.length === 0) tags.push("needs_review");

  const workflowState = memberWorkflowState(m);
  return {
    reasonTags: pickTags(tags),
    workflowState,
    nextActionLabel: nextActionForUnresolved(m, workflowState),
  };
}

function nextActionForAnchor(m: EnrichedBeautyZoneMember, state: BuildWorkflowState): string | null {
  if (state === "promoted") return "Already anchor";
  if (hasBooking(m) && hasStorefrontSignal(m)) return "Confirm anchor role";
  return "Review candidate";
}

/**
 * Anchor-candidate row: storefront / booking / DORA density cues.
 */
export function derivePotentialAnchorState(m: EnrichedBeautyZoneMember): DerivedBuildItemState {
  const tags: BuildReasonTag[] = [];
  if (hasStorefrontSignal(m)) tags.push("storefront");
  if (hasBooking(m)) tags.push("booking");
  if (techNearbyProxy(m) > 1) tags.push("nearby_licenses");
  if (isSalonLike(m) && techNearbyProxy(m) > 1) tags.push("anchor_like");
  if (tags.length === 0) tags.push("anchor_like");

  const workflowState = memberWorkflowState(m);

  return {
    reasonTags: pickTags(tags),
    workflowState,
    nextActionLabel: nextActionForAnchor(m, workflowState),
  };
}

export type PlatformSignalContext = {
  source: "member" | "live_unit";
  isBookable: boolean;
};

/**
 * Platform row from stitched member booking fields vs approved live unit platformSignals.
 */
export function derivePlatformSignalState(ctx: PlatformSignalContext): DerivedBuildItemState {
  const tags: BuildReasonTag[] = ["platform_match"];
  if (ctx.source === "live_unit") tags.push("matched_live_unit");
  if (ctx.isBookable) tags.push("bookable");

  let workflowState: BuildWorkflowState = "unknown";
  if (ctx.source === "live_unit") workflowState = "linked";
  else if (ctx.isBookable) workflowState = "bookable";
  else workflowState = "unreviewed";

  let nextActionLabel: string | null = null;
  if (workflowState === "linked") nextActionLabel = "Open in Live Units";
  else if (workflowState === "bookable") nextActionLabel = "Verify booking path";
  else nextActionLabel = "Enrich listing";

  return {
    reasonTags: pickTags(tags),
    workflowState,
    nextActionLabel,
  };
}
