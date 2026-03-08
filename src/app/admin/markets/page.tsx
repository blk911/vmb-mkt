import { getMarkets, getRegions } from "@/lib/markets";
import MarketsClient from "./MarketsClient";

export default function MarketsPage() {
  const regions = getRegions();
  const zones = getMarkets();
  return <MarketsClient regions={regions} zones={zones} />;
}
