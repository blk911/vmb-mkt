"use client";

import type { ManualIgCluster } from "@/lib/manual-ig-clusters/types";

type ManualIgClustersTableProps = {
  clusters: ManualIgCluster[];
  selectedClusterId?: string;
  busyKey?: string | null;
  onOpen: (clusterId: string) => void;
};

export function ManualIgClustersTable({
  clusters,
  selectedClusterId,
  busyKey,
  onOpen,
}: ManualIgClustersTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Saved Clusters</h2>
          <p className="text-sm text-neutral-600">Each cluster is isolated to its copied origin account until specific handles are accepted.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{clusters.length} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Origin Handle</th>
              <th className="px-3 py-3">Market</th>
              <th className="px-3 py-3">Items</th>
              <th className="px-3 py-3">Accepted</th>
              <th className="px-3 py-3">Rejected</th>
              <th className="px-3 py-3">Unreviewed</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster) => (
              <tr
                key={cluster.clusterId}
                className={cluster.clusterId === selectedClusterId ? "bg-neutral-50" : "border-b border-neutral-100"}
              >
                <td className="px-3 py-3 align-top text-neutral-700">{new Date(cluster.createdAt).toLocaleString()}</td>
                <td className="px-3 py-3 align-top font-medium text-neutral-900">@{cluster.sourceMeta.originHandle}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{cluster.sourceMeta.market || "n/a"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{cluster.itemCount}</td>
                <td className="px-3 py-3 align-top text-emerald-700">{cluster.acceptedCount}</td>
                <td className="px-3 py-3 align-top text-rose-700">{cluster.rejectedCount}</td>
                <td className="px-3 py-3 align-top text-amber-700">{cluster.unreviewedCount}</td>
                <td className="px-3 py-3 align-top">
                  <button
                    type="button"
                    onClick={() => onOpen(cluster.clusterId)}
                    disabled={busyKey === `open:${cluster.clusterId}`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
                  >
                    {busyKey === `open:${cluster.clusterId}` ? "Opening..." : "Open"}
                  </button>
                </td>
              </tr>
            ))}
            {clusters.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No manual IG clusters yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
