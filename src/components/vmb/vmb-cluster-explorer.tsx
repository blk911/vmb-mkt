"use client";

import { useMemo, useState } from "react";
import { useClusters } from "@/hooks/useClusters";
import ViewToggle, { type ViewMode } from "@/components/vmb/view-toggle";
import ClusterList from "@/components/vmb/cluster-list";
import ClusterDetailPanel from "@/components/vmb/cluster-detail-panel";
import type { BaseEntity, Cluster } from "@/lib/cluster/types";

type Props = {
  data: BaseEntity[];
};

export default function VmbClusterExplorer({ data }: Props) {
  const [mode, setMode] = useState<ViewMode>("shops");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const clusters = useClusters(data);

  const selectedCluster = useMemo<Cluster | null>(() => {
    if (!clusters.length) return null;
    if (!selectedClusterId) return clusters[0] ?? null;
    return clusters.find((c) => c.clusterId === selectedClusterId) ?? clusters[0] ?? null;
  }, [clusters, selectedClusterId]);

  const techRows = useMemo(() => (data || []).filter((d) => d.type === "dora_person"), [data]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Cluster engine (phase 3)</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Dominant anchor merge: overlapping Google + DORA shop rows collapse to one location row; detail panel explains
        merge vs conflict.
      </p>

      <div className="mt-4">
        <ViewToggle mode={mode} setMode={setMode} />

        {mode === "shops" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1fr)_520px]">
            <div className="min-w-0">
              <ClusterList
                clusters={clusters}
                selectedClusterId={selectedCluster?.clusterId ?? null}
                onSelect={(cluster) => setSelectedClusterId(cluster.clusterId)}
              />
            </div>

            <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <ClusterDetailPanel cluster={selectedCluster} allEntities={data || []} />
            </div>
          </div>
        ) : null}

        {mode === "techs" ? (
          <div className="space-y-2">
            {techRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="text-sm font-semibold text-neutral-900">{row.name}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {row.category || "unknown"} · {row.address || "Address unavailable"}
                </div>
              </div>
            ))}
            {!techRows.length ? <p className="text-sm text-neutral-500">No DORA person rows in this payload.</p> : null}
          </div>
        ) : null}

        {mode === "raw" ? (
          <pre className="max-h-[min(480px,60vh)] overflow-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
