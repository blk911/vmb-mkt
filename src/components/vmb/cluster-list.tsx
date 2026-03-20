import ClusterRow from "./cluster-row";
import type { Cluster } from "@/lib/cluster/types";

export default function ClusterList({ clusters }: { clusters: Cluster[] }) {
  if (!clusters.length) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
        No shop anchors (Google / DORA shop entities) in the dataset — nothing to cluster yet.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {clusters.map((c) => (
        <ClusterRow key={c.clusterId} c={c} />
      ))}
    </div>
  );
}
