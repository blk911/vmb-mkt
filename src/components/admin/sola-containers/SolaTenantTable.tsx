"use client";

import type { SolaTenantRecord } from "@/lib/sola-containers/types";

type SolaTenantTableProps = {
  tenants: SolaTenantRecord[];
  loading?: boolean;
};

function externalLink(url: string | undefined, label: string) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
    >
      {label}
    </a>
  );
}

export function SolaTenantTable({ tenants, loading }: SolaTenantTableProps) {
  const withInstagram = tenants.filter((tenant) => Boolean(tenant.instagramUrl)).length;
  const withWebsite = tenants.filter((tenant) => Boolean(tenant.websiteUrl)).length;
  const withBooking = tenants.filter((tenant) => Boolean(tenant.bookingUrl)).length;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Tenant Records</h3>
          <p className="text-sm text-neutral-600">Structured child records captured under the selected Sola parent container.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">{tenants.length} total</span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">{withInstagram} with IG</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{withWebsite} with website</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">{withBooking} with booking</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Tenant Name</th>
              <th className="px-3 py-3">Category Guess</th>
              <th className="px-3 py-3">Suite</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Links</th>
              <th className="px-3 py-3">Source Type</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-neutral-100">
                <td className="px-3 py-3 align-top font-medium text-neutral-900">{tenant.tenantName}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{tenant.categoryGuess}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{tenant.suite || "—"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{tenant.phone || "—"}</td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    {externalLink(tenant.instagramUrl, "IG")}
                    {externalLink(tenant.websiteUrl, "Site")}
                    {externalLink(tenant.bookingUrl, "Booking")}
                    {!tenant.instagramUrl && !tenant.websiteUrl && !tenant.bookingUrl ? (
                      <span className="text-neutral-400">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                    {tenant.sourceType}
                  </span>
                  {tenant.evidenceLabel ? <div className="mt-1 text-xs text-neutral-500">{tenant.evidenceLabel}</div> : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{tenant.status}</span>
                </td>
              </tr>
            ))}
            {!loading && tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No tenant records for this container yet.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                  Loading tenant records...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
