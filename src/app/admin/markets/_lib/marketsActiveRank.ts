import type { EnrichedBeautyZoneMember } from "@/lib/markets";

/** Reviewer “active” row: IG or booking provider (matches task spec). */
export function memberHasActivePresence(m: EnrichedBeautyZoneMember): boolean {
  const ig = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
  const bp = !!m.booking_provider?.trim();
  return ig || bp;
}

/**
 * Additive UI rank (does not replace `priority_score` on the member object).
 * +3 booking, +2 instagram, +2 anchor, +1 high density or base priority.
 */
export function computeActiveRankScore(m: EnrichedBeautyZoneMember): number {
  let s = 0;
  const booking = !!(m.booking_url?.trim() || m.booking_provider?.trim());
  const ig = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
  if (booking) s += 3;
  if (ig) s += 2;
  if (m.is_anchor) s += 2;
  const highDensity = (m.nearby_dora_licenses_total ?? 0) >= 10;
  const highBasePriority = (m.priority_score ?? 0) >= 6;
  if (highDensity || highBasePriority) s += 1;
  return s;
}

/** Default Salon Members order: active rank → anchor → upgraded score → name. */
export function compareDefaultSalonSort(a: EnrichedBeautyZoneMember, b: EnrichedBeautyZoneMember): number {
  const ar = computeActiveRankScore(b) - computeActiveRankScore(a);
  if (ar !== 0) return ar;
  const anch = (b.is_anchor ? 1 : 0) - (a.is_anchor ? 1 : 0);
  if (anch !== 0) return anch;
  const pr = b.upgraded_priority_score - a.upgraded_priority_score;
  if (pr !== 0) return pr;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Top Targets: anchors + presence + booking + upgraded score (compact weighted sum).
 */
export function compareTopTargetRank(a: EnrichedBeautyZoneMember, b: EnrichedBeautyZoneMember): number {
  const score = (m: EnrichedBeautyZoneMember) => {
    const active = memberHasActivePresence(m);
    const hasBook = !!(m.booking_url?.trim() || m.booking_provider?.trim());
    const hasIg = !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
    let s = 0;
    if (m.is_anchor && active) s += 500;
    if (hasBook) s += 120;
    if (m.is_anchor) s += 80;
    if (active) s += 60;
    if (hasIg) s += 40;
    s += m.upgraded_priority_score * 3;
    s += computeActiveRankScore(m);
    return s;
  };
  const c = score(b) - score(a);
  if (c !== 0) return c;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
