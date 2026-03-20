import { getApprovedLiveUnits, getMarkets, getRegions, getZoneMembersWithClusters } from "@/lib/markets";
import { parseMarketsUrlSearchParams } from "./_lib/marketsUrlState";
import MarketsClient from "./MarketsClient";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const regions = getRegions();
  const zones = getMarkets();
  const { members, clusters } = getZoneMembersWithClusters();
  const approvedLiveUnits = getApprovedLiveUnits();
  const sp = await searchParams;
  const initialUrlState = parseMarketsUrlSearchParams(sp, zones, regions);

  return (
    <MarketsClient
      regions={regions}
      zones={zones}
      members={members}
      clusters={clusters}
      approvedLiveUnits={approvedLiveUnits}
      initialUrlState={initialUrlState}
    />
  );
}
