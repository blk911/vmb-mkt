"use client";

import type { SolaTenantRecord } from "@/lib/sola-containers/types";

type SolaTenantTableProps = {
  tenants: SolaTenantRecord[];
  loading?: boolean;
};

function externalLink(url: string | undefined, label: string) {
  if (!url) return <span className="text-neutral-400">—</span>;
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
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Tenant Records</h3>
          <p className="text-sm text-neutral-600">Structured child records captured under the selected Sola parent container.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{tenants.length} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Tenant Name</th>
              <th className="px-3 py-3">Category Guess</th>
              <th className="px-3 py-3">Suite</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">IG</th>
              <th className="px-3 py-3">Site</th>
              <th className="px-3 py-3">Booking</th>
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
                <td className="px-3 py-3 align-top">{externalLink(tenant.instagramUrl, "IG")}</td>
                <td className="px-3 py-3 align-top">{externalLink(tenant.websiteUrl, "Site")}</td>
                <td className="px-3 py-3 align-top">{externalLink(tenant.bookingUrl, "Booking")}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{tenant.sourceType}</td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{tenant.status}</span>
                </td>
              </tr>
            ))}
            {!loading && tenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No tenant records for this container yet.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
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
