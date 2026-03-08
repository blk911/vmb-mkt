import { getMarkets, getRegions, getZoneMembersWithClusters } from "@/lib/markets";
import MarketsClient from "./MarketsClient";

export default function MarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();
  const { members, clusters } = getZoneMembersWithClusters();

  return <MarketsClient regions={regions} zones={zones} members={members} clusters={clusters} />;
}
