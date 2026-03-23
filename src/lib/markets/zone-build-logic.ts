/**
 * Derive build-mode summaries from enriched members + clusters already in the Markets payload.
 */
import type { ApprovedLiveUnit, BeautyZoneCluster, EnrichedBeautyZoneMember } from "@/lib/markets";
import { getZoneDisplayLabel } from "@/lib/geo/target-zones";
import type { ZoneBuildSummary } from "./zone-build-types";

function hasBooking(m: EnrichedBeautyZoneMember): boolean {
  return !!(m.booking_url?.trim() || m.booking_provider?.trim());
}

function hasIg(m: EnrichedBeautyZoneMember): boolean {
  return !!(m.instagram_url?.trim() || m.instagram_handle?.trim());
}

function isGoogleSourced(m: EnrichedBeautyZoneMember): boolean {
  const s = (m.source || "").toLowerCase();
  return s.includes("google");
}

export function deriveZoneBuildSummary(
  zoneId: string,
  members: EnrichedBeautyZoneMember[],
  clusters: BeautyZoneCluster[],
  approvedLiveUnits: ApprovedLiveUnit[]
): ZoneBuildSummary {
  const zm = members.filter((m) => m.zone_id === zoneId);
  const zoneClusters = clusters.filter((c) => c.zone_id === zoneId);
  const label = getZoneDisplayLabel(zoneId);

  let doraLicenseRefsTotal = 0;
  let membersWithDoraSignalCount = 0;
  let googleSourceMemberCount = 0;
  let coldIdentityMemberCount = 0;
  let grayResolutionUnmatchedCount = 0;

  for (const m of zm) {
    const d = m.nearby_dora_licenses_total ?? 0;
    doraLicenseRefsTotal += d;
    if (d > 0) membersWithDoraSignalCount += 1;
    if (isGoogleSourced(m)) googleSourceMemberCount += 1;
    if (!hasIg(m) && !hasBooking(m)) coldIdentityMemberCount += 1;
    if (m.gray_resolution_matched === false) grayResolutionUnmatchedCount += 1;
  }

  const approvedLiveUnitsInZoneCount = approvedLiveUnits.filter((u) =>
    u.linked_zones.some((z) => z.zone_id === zoneId)
  ).length;

  const stitchedMemberCount = zm.length;
  const clusterSeedCount = zoneClusters.length;

  let narrativeLine = "";
  if (stitchedMemberCount === 0) {
    narrativeLine =
      "No stitched member rows in this zone yet — survey or import candidates before operational work.";
  } else if (coldIdentityMemberCount > stitchedMemberCount * 0.5) {
    narrativeLine =
      "Many listings are still cold on digital identity (no IG/booking); prioritize site identity + enrichment.";
  } else if (grayResolutionUnmatchedCount > 0) {
    narrativeLine = `${grayResolutionUnmatchedCount} gray-resolution rows not resolved — candidate review may help.`;
  } else {
    narrativeLine = "Source material exists; continue stitching and enrichment into the operational roster.";
  }

  return {
    zoneId,
    zoneLabel: label,
    stitchedMemberCount,
    clusterSeedCount,
    membersWithDoraSignalCount,
    doraLicenseRefsTotal,
    googleSourceMemberCount,
    coldIdentityMemberCount,
    grayResolutionUnmatchedCount,
    approvedLiveUnitsInZoneCount,
    narrativeLine,
  };
}
