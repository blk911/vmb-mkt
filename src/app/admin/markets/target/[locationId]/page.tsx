import { notFound } from "next/navigation";
import { getMarkets, getRegions, getZoneMembersWithClusters } from "@/lib/markets";
import {
  computeClusterActiveMetrics,
  type ClusterActiveMetrics,
} from "@/app/admin/markets/_lib/marketsClusterActive";
import {
  buildNearbyProspects,
  memberHasValidCoords,
  rollupForRing,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";
import { parseMarketsUrlSearchParams, parseRingQuery } from "@/app/admin/markets/_lib/marketsUrlState";
import { SalesTargetPageClient } from "./SalesTargetPageClient";

function getFirst(raw: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = raw[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function SalesTargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locationId: rawParam } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(String(rawParam ?? "").trim());
  if (!decoded) notFound();

  const regions = getRegions();
  const zones = getMarkets();
  const { members, clusters } = getZoneMembersWithClusters();
  const marketsUrlState = parseMarketsUrlSearchParams(sp, zones, regions);
  const initialRing = parseRingQuery(getFirst(sp, "ring"));

  const origin = members.find((m) => m.location_id === decoded) ?? null;
  if (!origin) notFound();

  const selectedZoneMembers = members.filter((m) => m.zone_id === origin.zone_id);
  const selectedZoneClusters = clusters.filter((c) => c.zone_id === origin.zone_id);

  const clusterMetricsById = new Map<string, ClusterActiveMetrics>();
  for (const cl of selectedZoneClusters) {
    const mems = selectedZoneMembers.filter((m) => m.cluster_id === cl.cluster_id);
    clusterMetricsById.set(cl.cluster_id, computeClusterActiveMetrics(cl, mems));
  }

  const nearbyRows = buildNearbyProspects(origin, selectedZoneMembers, clusterMetricsById, 1.0);
  const ringRollups = {
    r25: rollupForRing(nearbyRows, 0.25),
    r5: rollupForRing(nearbyRows, 0.5),
    r1: rollupForRing(nearbyRows, 1.0),
  };

  return (
    <SalesTargetPageClient
      origin={origin}
      nearbyRows={nearbyRows}
      ringRollups={ringRollups}
      marketsUrlState={marketsUrlState}
      initialRing={initialRing}
      hasValidCoords={memberHasValidCoords(origin)}
    />
  );
}
