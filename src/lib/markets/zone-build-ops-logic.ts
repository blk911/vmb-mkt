/**
 * Derive Build Mode work queues from enriched zone members (+ optional live unit rows with platform signals).
 */
import type { ApprovedLiveUnit, EnrichedBeautyZoneMember } from "@/lib/markets";
import type { PlatformSignalsRecord } from "@/lib/live-units/platform-signal-types";
import type {
  ZoneBuildOpsData,
  ZonePlatformSignalItem,
  ZonePotentialAnchor,
  ZoneUnresolvedCandidate,
} from "./zone-build-ops-types";

/** Runtime shape: approved JSON may include platformSignals / tech_count_nearby like Live Units UI. */
export type ApprovedLiveUnitWithSignals = ApprovedLiveUnit & {
  tech_count_nearby?: number;
  platformSignals?: PlatformSignalsRecord | null;
};

const NEEDS_REVIEW_MIN = 40;
const NEEDS_REVIEW_MAX = 69;

function inZone<T extends { zone_id: string }>(rows: T[], zoneId: string): T[] {
  return rows.filter((r) => r.zone_id === zoneId);
}

function hasIg(m: EnrichedBeautyZoneMember): boolean {
  return !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
}

function hasBooking(m: EnrichedBeautyZoneMember): boolean {
  return !!(m.booking_url?.trim() || m.booking_provider?.trim());
}

function techNearbyProxy(m: EnrichedBeautyZoneMember): number {
  const licenses = m.nearby_dora_licenses_total ?? 0;
  const instore = m.nearby_dora_instore_likely_count ?? 0;
  return Math.max(licenses, instore);
}

function entityKindLabel(m: EnrichedBeautyZoneMember): string | undefined {
  const cat = (m.category || "").trim();
  const sub = (m.subtype || "").trim();
  if (cat && sub) return `${cat} · ${sub}`;
  return cat || sub || undefined;
}

/** Operational “shop” entities in Markets data (category is hair/nail/… not literal “salon”). */
function isSalonOrMixedEntity(m: EnrichedBeautyZoneMember): boolean {
  const cat = (m.category || "").toLowerCase();
  const sub = (m.subtype || "").toLowerCase();
  const cr = (m.category_raw || "").toLowerCase();
  const salonLike = ["hair", "nail", "esthe", "barber", "spa", "beauty"].includes(cat);
  if (salonLike) return true;
  if (sub === "mixed" || cat === "mixed") return true;
  if (cr.includes("salon") || cr.includes("barber") || cr.includes("nail") || cr.includes("spa")) return true;
  return false;
}

function hasStorefrontSignal(m: EnrichedBeautyZoneMember): boolean {
  if ((m.subtype || "").toLowerCase() === "storefront") return true;
  if ((m.nearby_dora_instore_likely_count ?? 0) > 0) return true;
  return false;
}

function serviceSignalsFromMember(m: EnrichedBeautyZoneMember): string[] {
  const out: string[] = [];
  const mix = m.nearby_dora_operational_mix;
  if (mix) {
    if (mix.hair) out.push(`hair ${mix.hair}`);
    if (mix.nail) out.push(`nail ${mix.nail}`);
    if (mix.esthe) out.push(`esthe ${mix.esthe}`);
    if (mix.barber) out.push(`barber ${mix.barber}`);
    if (mix.spa) out.push(`spa ${mix.spa}`);
  }
  if (out.length === 0 && m.category) out.push(m.category);
  if (m.subtype) out.push(m.subtype);
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))].slice(0, 8);
}

/** Low confidence, not yet promoted to anchor, or weak digital identity — sorted worst-first, cap 25. */
export function getZoneUnresolvedCandidates(
  members: EnrichedBeautyZoneMember[],
  zoneId: string
): ZoneUnresolvedCandidate[] {
  const zm = inZone(members, zoneId);

  const scored = zm.map((m) => {
    const inReviewBand =
      m.upgraded_priority_score >= NEEDS_REVIEW_MIN && m.upgraded_priority_score <= NEEDS_REVIEW_MAX;
    const lowBase = (m.priority_score ?? 0) < 4;
    const missingStrongIdentity = !hasIg(m) && !hasBooking(m);
    const grayUnresolved = m.gray_resolution_matched === false;
    const pathRejected = m.path_enrichment_matched === false;

    const hit =
      grayUnresolved ||
      inReviewBand ||
      pathRejected ||
      (!m.is_anchor && missingStrongIdentity && m.upgraded_priority_score < 60) ||
      (!m.is_anchor && missingStrongIdentity && lowBase);

    let score = 0;
    if (grayUnresolved) score += 100;
    if (pathRejected) score += 55;
    if (inReviewBand) score += 45;
    if (missingStrongIdentity) score += 35;
    if (!m.is_anchor) score += 10;
    if (m.upgraded_priority_score <= NEEDS_REVIEW_MAX) score += Math.max(0, 55 - m.upgraded_priority_score);

    return { m, hit, score };
  });

  const filtered = scored.filter((x) => x.hit);
  filtered.sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name));

  return filtered.slice(0, 25).map(({ m }) => ({
    id: m.location_id,
    name: m.name,
    zoneId: m.zone_id,
    distance: m.distance_miles,
    entityKind: entityKindLabel(m),
    hasInstagram: hasIg(m),
    hasBooking: hasBooking(m),
    serviceSignals: serviceSignalsFromMember(m),
  }));
}

/** Salon/mixed entities with DORA density + storefront or booking — ranked by tech proxy. */
export function getZonePotentialAnchors(
  members: EnrichedBeautyZoneMember[],
  zoneId: string
): ZonePotentialAnchor[] {
  const zm = inZone(members, zoneId);

  const candidates = zm.filter((m) => {
    if (!isSalonOrMixedEntity(m)) return false;
    const tech = techNearbyProxy(m);
    if (tech <= 1) return false;
    return hasStorefrontSignal(m) || hasBooking(m);
  });

  candidates.sort((a, b) => {
    const ta = techNearbyProxy(a);
    const tb = techNearbyProxy(b);
    if (tb !== ta) return tb - ta;
    const ba = hasBooking(a) ? 1 : 0;
    const bb = hasBooking(b) ? 1 : 0;
    if (bb !== ba) return bb - ba;
    return a.name.localeCompare(b.name);
  });

  return candidates.slice(0, 10).map((m) => ({
    id: m.location_id,
    name: m.name,
    techCountNearby: techNearbyProxy(m),
    hasStorefrontSignal: hasStorefrontSignal(m),
    hasBooking: hasBooking(m),
  }));
}

function normalizePlatformLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return "unknown";
  return s.replace(/_/g, " ");
}

function memberBookingPlatform(m: EnrichedBeautyZoneMember): string | null {
  const direct = (m.booking_provider || "").trim();
  if (direct) return normalizePlatformLabel(direct);
  const pe = (m.path_enrichment_booking_provider || "").trim();
  if (pe) return normalizePlatformLabel(pe);
  const ad = (m.anchor_directory_booking_provider || "").trim();
  if (ad) return normalizePlatformLabel(ad);
  return null;
}

/** Booking providers on members + structured platformSignals on linked approved live units. */
export function getZonePlatformSignals(
  members: EnrichedBeautyZoneMember[],
  zoneId: string,
  liveUnits: ApprovedLiveUnitWithSignals[]
): ZonePlatformSignalItem[] {
  const items: ZonePlatformSignalItem[] = [];
  const seen = new Set<string>();

  const push = (id: string, name: string, platform: string, isBookable: boolean) => {
    const key = `${id}::${platform.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id, name, platform, isBookable });
  };

  for (const m of inZone(members, zoneId)) {
    const p = memberBookingPlatform(m);
    if (p) {
      push(m.location_id, m.name, p, !!(m.booking_url?.trim() || m.path_enrichment_booking_url?.trim()));
    }
  }

  for (const u of liveUnits) {
    if (!u.linked_zones?.some((z) => z.zone_id === zoneId)) continue;
    const ps = u.platformSignals;
    if (!ps) continue;
    for (const [platformKey, sig] of Object.entries(ps) as [keyof PlatformSignalsRecord, { isBookable?: boolean } | undefined][]) {
      if (!sig) continue;
      push(u.live_unit_id, u.name_display, String(platformKey), !!sig.isBookable);
    }
  }

  return items.slice(0, 15);
}

export function deriveZoneBuildOpsData(
  rows: EnrichedBeautyZoneMember[],
  zoneId: string,
  liveUnits: ApprovedLiveUnitWithSignals[] = []
): ZoneBuildOpsData {
  return {
    unresolved: getZoneUnresolvedCandidates(rows, zoneId),
    anchors: getZonePotentialAnchors(rows, zoneId),
    platforms: getZonePlatformSignals(rows, zoneId, liveUnits),
  };
}
