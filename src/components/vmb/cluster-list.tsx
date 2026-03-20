import type { Cluster } from "@/lib/cluster/types";
import ClusterRow from "./cluster-row";

export default function ClusterList({
  clusters,
  selectedClusterId,
  onSelect,
}: {
  clusters: Cluster[];
  selectedClusterId?: string | null;
  onSelect?: (cluster: Cluster) => void;
}) {
  if (!clusters.length) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
        No shop anchors (Google / DORA shop entities) in the dataset — nothing to cluster yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {clusters.map((cluster) => (
        <ClusterRow
          key={cluster.clusterId}
          cluster={cluster}
          isSelected={selectedClusterId === cluster.clusterId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
