import { getApprovedLiveUnits, getMarkets, getRegions, getZoneMembersWithClusters } from "@/lib/markets";
import MarketsClient from "./MarketsClient";

export default function MarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();
  const { members, clusters } = getZoneMembersWithClusters();
  const approvedLiveUnits = getApprovedLiveUnits();

  return (
    <MarketsClient
      regions={regions}
      zones={zones}
      members={members}
      clusters={clusters}
      approvedLiveUnits={approvedLiveUnits}
    />
  );
}
