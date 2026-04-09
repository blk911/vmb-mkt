"use client";

import type { SocialDiscoveryQueueItem, SocialDiscoveryResult } from "@/lib/source-intake/phase2-types";

type SocialQueueRow = {
  item: SocialDiscoveryQueueItem;
  result?: SocialDiscoveryResult | null;
};

type SocialQueueTableProps = {
  rows: SocialQueueRow[];
  busyQueueItemId?: string | null;
  onResolve: (queueItemId: string) => void;
};

export function SocialQueueTable({ rows, busyQueueItemId, onResolve }: SocialQueueTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Social Queue</h3>
          <p className="text-sm text-neutral-600">Surface-discovery tasks backed by existing Google-discovery and normalization helpers.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{rows.length} items</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Candidate</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Attempts</th>
              <th className="px-3 py-3">Surfaces Found</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, result }) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="px-3 py-3 align-top text-neutral-700">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="px-3 py-3 align-top font-medium text-neutral-900">{item.displayName}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{item.sourceLabel}</td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{item.status}</span>
                </td>
                <td className="px-3 py-3 align-top text-neutral-700">{item.attempts}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{result?.discoveredSurfaces.length ?? 0}</td>
                <td className="px-3 py-3 align-top">
                  <button
                    type="button"
                    disabled={busyQueueItemId === item.id || Boolean(result)}
                    onClick={() => onResolve(item.id)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
                  >
                    {busyQueueItemId === item.id ? "Resolving..." : result ? "View Result" : "Resolve"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No social queue items for this intake.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
