import RollupDetailClient from "./RollupDetailClient";

export default function RollupDetailPage({
  params,
}: {
  params: { addrKey: string };
}) {
  const addrKey = decodeURIComponent(params.addrKey || "");
  return <RollupDetailClient addrKey={addrKey} />;
}
