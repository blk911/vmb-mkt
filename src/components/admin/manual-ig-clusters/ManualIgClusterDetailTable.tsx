"use client";

import type { ManualIgCluster } from "@/lib/manual-ig-clusters/types";

type ManualIgClusterDetailTableProps = {
  cluster: ManualIgCluster;
  busyKey?: string | null;
  onAccept: (itemId: string) => void;
  onReject: (itemId: string) => void;
};

function statusBadgeClass(status: ManualIgCluster["items"][number]["status"]): string {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

export function ManualIgClusterDetailTable({
  cluster,
  busyKey,
  onAccept,
  onReject,
}: ManualIgClusterDetailTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">@{cluster.sourceMeta.originHandle}</h3>
          <p className="text-sm text-neutral-600">
            Cluster {cluster.clusterId}
            {cluster.sourceMeta.market ? ` • ${cluster.sourceMeta.market}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-neutral-700">
          <span className="rounded-full bg-neutral-100 px-3 py-1">{cluster.itemCount} items</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{cluster.acceptedCount} accepted</span>
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">{cluster.rejectedCount} rejected</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{cluster.unreviewedCount} unreviewed</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Handle</th>
              <th className="px-3 py-3">Display Name</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Confidence</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cluster.items.map((item) => {
              const resolved = item.status !== "unreviewed";
              return (
                <tr key={item.id} className="border-b border-neutral-100">
                  <td className="px-3 py-3 align-top font-medium text-neutral-900">@{item.handle}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{item.displayName}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{item.categoryGuess}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{item.confidence.toFixed(2)}</td>
                  <td className="px-3 py-3 align-top">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onAccept(item.id)}
                        disabled={resolved || busyKey === `accept:${item.id}` || busyKey === `reject:${item.id}`}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busyKey === `accept:${item.id}` ? "Accepting..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(item.id)}
                        disabled={resolved || busyKey === `accept:${item.id}` || busyKey === `reject:${item.id}`}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
                      >
                        {busyKey === `reject:${item.id}` ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
