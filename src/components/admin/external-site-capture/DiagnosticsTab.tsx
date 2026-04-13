"use client";

import type { VmbMappedProfile } from "@/lib/external-site-capture/types";

type DiagnosticsTabProps = {
  mapped: VmbMappedProfile | null;
};

function readinessStatus(mapped: VmbMappedProfile): "High" | "Medium" | "Low" {
  return mapped.parseConfidence;
}

export function DiagnosticsTab({ mapped }: DiagnosticsTabProps) {
  if (!mapped) return <p className="text-sm text-neutral-500">No diagnostics yet.</p>;

  const readiness = readinessStatus(mapped);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Readiness</h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-semibold text-white">{readiness}</span>
          <span className="text-sm text-neutral-600">
            {mapped.serviceCards.length} services • {mapped.favoriteCards.length} providers • {mapped.portfolioImages.length} images
          </span>
        </div>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Diagnostics</h3>
        {mapped.diagnostics.length ? (
          <ul className="grid gap-2 text-sm text-neutral-700">
            {mapped.diagnostics.map((diagnostic) => (
              <li key={diagnostic} className="rounded-xl bg-neutral-50 px-3 py-2">
                {diagnostic}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">No diagnostics flagged.</p>
        )}
      </section>
    </div>
  );
}
