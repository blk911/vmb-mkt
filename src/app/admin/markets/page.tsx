import { getMarkets, getRegions, getZoneMembers } from "@/lib/markets";
import MarketsClient from "./MarketsClient";

export default function MarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();
  const members = getZoneMembers();

  return <MarketsClient regions={regions} zones={zones} members={members} />;
}
