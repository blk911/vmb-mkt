import type { Cluster } from "@/lib/cluster/types";

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-800">
      {text}
    </span>
  );
}

export default function EvidenceBadges({ cluster }: { cluster: Cluster }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {pill(cluster.clusterHeadType.toUpperCase())}
      {pill(cluster.status.toUpperCase())}
      {cluster.google.some((x) => x.decision === "merged") && pill("GOOGLE")}
      {cluster.doraShops.some((x) => x.decision === "merged") && pill("DORA SHOP")}
      {cluster.doraPeople.some((x) => x.decision === "merged") && pill("TECHS")}
    </div>
  );
}
