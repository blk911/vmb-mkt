"use client";

import type { SolaContainer } from "@/lib/sola-containers/types";

type SolaContainerTableProps = {
  containers: SolaContainer[];
  selectedContainerId?: string;
  busyKey?: string | null;
  onSelect: (containerId: string) => void;
  onMarkReady: (containerId: string) => void;
};

function formatDistance(distanceMiles?: number): string {
  return typeof distanceMiles === "number" ? `${distanceMiles.toFixed(1)} mi` : "n/a";
}

function renderExternalLink(url?: string) {
  if (!url) return <span className="text-neutral-400">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="text-xs font-medium text-sky-700 hover:underline"
    >
      Open
    </a>
  );
}

export function SolaContainerTable({
  containers,
  selectedContainerId,
  busyKey,
  onSelect,
  onMarkReady,
}: SolaContainerTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Canonical Containers</h2>
          <p className="text-sm text-neutral-600">Select a location name to review tenant pulls under that parent container.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{containers.length} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Brand</th>
              <th className="px-3 py-3">Location Name</th>
              <th className="px-3 py-3">City</th>
              <th className="px-3 py-3">ZIP</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Distance</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Location Page URL</th>
              <th className="px-3 py-3">Directory Page URL</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((container) => (
              <tr
                key={container.id}
                className={container.id === selectedContainerId ? "bg-neutral-50" : "border-b border-neutral-100"}
              >
                <td className="px-3 py-3 align-top text-neutral-700">{container.brand}</td>
                <td className="px-3 py-3 align-top">
                  <button
                    type="button"
                    onClick={() => onSelect(container.id)}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {container.name}
                  </button>
                </td>
                <td className="px-3 py-3 align-top text-neutral-700">{container.city}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{container.zip || "n/a"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{container.phone || "n/a"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{formatDistance(container.distanceMiles)}</td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                    {container.status}
                  </span>
                </td>
                <td className="px-3 py-3 align-top text-neutral-700">{renderExternalLink(container.locationPageUrl)}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{renderExternalLink(container.directoryPageUrl)}</td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMarkReady(container.id)}
                      disabled={busyKey === `ready:${container.id}`}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
                    >
                      {busyKey === `ready:${container.id}` ? "Saving..." : "Mark Ready"}
                    </button>
                    {container.locationPageUrl ? (
                      <a
                        href={container.locationPageUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {containers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No Sola containers seeded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
