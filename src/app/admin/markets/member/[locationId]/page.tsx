import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEnrichedMemberByLocationId, getMarketById } from "@/lib/markets";

type PageProps = {
  params: Promise<{ locationId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locationId: raw } = await params;
  const locationId = decodeURIComponent(raw || "");
  const member = getEnrichedMemberByLocationId(locationId);
  if (!member) return { title: "Listing · Markets" };
  return { title: `${member.name} · Markets` };
}

function formatProfessionMixRow(member: {
  nearby_dora_hair_count?: number;
  nearby_dora_nail_count?: number;
  nearby_dora_esthe_count?: number;
  nearby_dora_barber_count?: number;
  nearby_dora_spa_count?: number;
}) {
  return [
    { label: "Hair", value: member.nearby_dora_hair_count ?? 0 },
    { label: "Nail", value: member.nearby_dora_nail_count ?? 0 },
    { label: "Esthe", value: member.nearby_dora_esthe_count ?? 0 },
    { label: "Barber", value: member.nearby_dora_barber_count ?? 0 },
    { label: "Spa", value: member.nearby_dora_spa_count ?? 0 },
  ];
}

export default async function MarketMemberListingPage({ params }: PageProps) {
  const { locationId: raw } = await params;
  const locationId = decodeURIComponent(raw || "");
  const member = getEnrichedMemberByLocationId(locationId);
  if (!member) notFound();

  const zone = getMarketById(member.zone_id);
  const addressLine = [member.address, member.city, member.state, member.zip].filter(Boolean).join(", ");
  const professionRows = formatProfessionMixRow(member);
  const rawMixEntries = Object.entries(member.nearby_dora_profession_mix_raw ?? {}).sort((a, b) => b[1] - a[1]);
  const operational = member.nearby_dora_operational_mix;

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/admin/markets"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
          >
            ← Back to Markets
          </Link>
        </div>

        <header className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Salon listing</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{member.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {zone?.zone_name ?? member.zone_name} · {member.market}
          </p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Category</dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-900">{member.category}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Subtype</dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-900">{member.subtype}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Priority score</dt>
              <dd className="mt-1 text-lg font-semibold text-emerald-800">{member.upgraded_priority_score}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Anchor</dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-900">{member.is_anchor ? "Yes" : "No"}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Address</div>
            <p className="mt-1 text-sm text-neutral-800">{addressLine || "—"}</p>
          </div>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Tech in-store (profession mix)</h2>
          <p className="mt-1 text-sm text-neutral-600">
            DORA profession counts attributed to this location&apos;s operational mix (table &quot;Profession Mix&quot;).
          </p>

          {operational ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {(["hair", "nail", "esthe", "barber", "spa"] as const).map((k) => (
                <div key={k} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                  <div className="text-[11px] font-semibold uppercase text-neutral-500">{k}</div>
                  <div className="mt-1 text-xl font-semibold text-neutral-900">{operational[k]}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-neutral-600">
                  <th className="px-4 py-2 font-medium">Profession</th>
                  <th className="px-4 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {professionRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-2 text-neutral-800">{row.label}</td>
                    <td className="px-4 py-2 font-medium text-neutral-900">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rawMixEntries.length ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Raw DORA labels</div>
              <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
                {rawMixEntries.map(([label, count]) => (
                  <li key={label}>
                    {label}: <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">No raw profession labels on file.</p>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Nearby (DORA density)</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Licenses within the density radius around this point (table &quot;DORA Density&quot;).
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Total nearby licenses</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-900">{member.nearby_dora_licenses_total ?? 0}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Radius</dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-900">
                {member.dora_density_radius_miles != null ? `${member.dora_density_radius_miles} mi` : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Profile</dt>
              <dd className="mt-1 text-sm text-neutral-800">{member.dora_density_profile ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <div className="pb-8">
          <Link
            href="/admin/markets"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
          >
            ← Back to Markets
          </Link>
        </div>
      </div>
    </div>
  );
}
