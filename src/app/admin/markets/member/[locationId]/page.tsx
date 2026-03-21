import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMarketsListPath, parseMarketsUrlSearchParams } from "../../_lib/marketsUrlState";
import { getEnrichedMemberByLocationId, getMarketById, getMarkets, getRegions } from "@/lib/markets";
import LicenseHoldersTable from "./LicenseHoldersTable";
import { PathEnrichmentSection } from "@/components/admin/PathEnrichment";
import { PresenceBadges, PresenceRawLinksDetails } from "@/components/admin/PresenceBadges";

type PageProps = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

export default async function MarketMemberListingPage({ params, searchParams }: PageProps) {
  const { locationId: raw } = await params;
  const locationId = decodeURIComponent(raw || "");
  const member = getEnrichedMemberByLocationId(locationId);
  if (!member) notFound();

  const rawSp = await searchParams;
  const zones = getMarkets();
  const regions = getRegions();
  const backHref = buildMarketsListPath(parseMarketsUrlSearchParams(rawSp, zones, regions));

  const zone = getMarketById(member.zone_id);
  const addressLine = [member.address, member.city, member.state, member.zip].filter(Boolean).join(", ");
  const professionRows = formatProfessionMixRow(member);
  const rawMixEntries = Object.entries(member.nearby_dora_profession_mix_raw ?? {}).sort((a, b) => b[1] - a[1]);
  const operational = member.nearby_dora_operational_mix;
  const instoreThreshold = member.nearby_dora_instore_threshold_miles ?? 0.02;
  const rankedLicenses = member.nearby_dora_licenses_ranked ?? [];
  const rankedAddresses = member.nearby_dora_addresses_ranked ?? [];
  const hasDistanceDetail = rankedLicenses.length > 0 || rankedAddresses.length > 0;
  const totalNearby = member.nearby_dora_licenses_total ?? 0;
  /** Enriched file includes v2 ranked arrays (may be empty arrays in edge cases). */
  const rankedFieldsPresent =
    member.nearby_dora_licenses_ranked !== undefined || member.nearby_dora_addresses_ranked !== undefined;

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href={backHref}
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

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Presence (site identity)
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Outbound social / booking links when merged from the site_identity pipeline into zone member JSON.
            </p>
            <div className="mt-2">
              <PresenceBadges member={member} />
            </div>
            <PresenceRawLinksDetails member={member} />
          </div>

          <PathEnrichmentSection member={member} />
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
            <strong>Where are these licenses?</strong> They are <strong>individual DORA license rows</strong> whose{" "}
            <strong>registered business address</strong> falls inside the density circle (e.g. {member.dora_density_radius_miles ?? "—"} mi) around{" "}
            <strong>this listing&apos;s lat/lon</strong>—the same point used for the salon on the map. They are{" "}
            <strong>not</strong> labeled by the state as &quot;employed at this salon.&quot; &quot;Nearby&quot; means{" "}
            <strong>geographic proximity</strong> in our model, not an official &quot;attached&quot; or payroll link.
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            <strong>Confidence:</strong> Distance numbers are <strong>readable</strong> when shown (miles from listing GPS to
            geocoded DORA address). They are still <strong>estimates</strong>: geocodes can sit on the street center, suites
            share one pin, and GPS for the listing can differ slightly from DORA&apos;s address. Use them as a{" "}
            <strong>triage signal</strong>—strongest when distance is tiny (same building / pad); weaker toward the edge of
            the ring.
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Each count is a <strong>DORA license row</strong> tied to a registered address. Where we show miles, that is
            haversine distance from this listing&apos;s GPS to that address&apos;s coordinates.
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            <strong>Likely same pad</strong> uses a fixed heuristic: license at a DORA address within{" "}
            <strong>{instoreThreshold} mi</strong> of the listing GPS. This is not legal verification of employment—only a
            proximity band for triage.
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Total nearby licenses</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-900">{member.nearby_dora_licenses_total ?? 0}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Density radius</dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-900">
                {member.dora_density_radius_miles != null ? `${member.dora_density_radius_miles} mi` : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Likely same pad (≤ {instoreThreshold} mi)
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-emerald-900">
                {member.nearby_dora_instore_likely_count ?? "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Farther in ring</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-900">{member.nearby_dora_ring_count ?? "—"}</dd>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 sm:col-span-2 lg:col-span-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Profile</dt>
              <dd className="mt-1 text-sm text-neutral-800">{member.dora_density_profile ?? "—"}</dd>
            </div>
          </dl>

          {!hasDistanceDetail ? (
            <div className="mt-4 space-y-3">
              {totalNearby > 0 ? (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                  The <strong>{totalNearby}</strong> total is already computed: that many roster licenses sit at addresses
                  inside the ring around this pin. The <strong>names and per-row distances</strong> below only appear when this
                  app loads an enriched file that includes <code className="rounded bg-white px-1 text-xs">nearby_dora_licenses_ranked</code>{" "}
                  (and address ranks). If you ran{" "}
                  <code className="rounded bg-white px-1 text-xs">npm run markets:enrich:dora</code> locally but still see
                  this, <strong>commit and push</strong>{" "}
                  <code className="rounded bg-white px-1 text-xs">data/markets/beauty_zone_members_enriched_with_presence.json</code>{" "}
                  (or <code className="rounded bg-white px-1 text-xs">beauty_zone_members_enriched.json</code>) so
                  production matches—or run enrich in CI and deploy.
                </p>
              ) : null}
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {!rankedFieldsPresent && totalNearby > 0
                  ? "This build of the data file does not include ranked license rows yet."
                  : "Per-license distance rows are empty for this member (or data not rebuilt). "}
                Regenerate with{" "}
                <code className="rounded bg-white px-1 py-0.5 text-xs">npm run markets:enrich:dora</code>, then ensure the
                updated JSON is what your server ships.
              </p>
            </div>
          ) : (
            <>
              {rankedLicenses.length ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-neutral-900">License holders (by distance)</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Default: <strong className="font-medium text-neutral-700">active</strong> licenses first, then closest by
                    miles. Same distance = same registered address (suite/building). Use column headers to sort by type,
                    status, or miles; click <strong className="font-medium text-neutral-700">Name</strong> to restore the
                    default order.
                  </p>
                  <LicenseHoldersTable rows={rankedLicenses} />
                </div>
              ) : null}

              {rankedAddresses.length ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-neutral-900">DORA addresses (by distance)</h3>
                  <p className="mt-1 text-xs text-neutral-500">Aggregated license counts per registered address.</p>
                  <div className="mt-2 max-h-[min(280px,40vh)] overflow-auto rounded-xl border border-neutral-200">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                      <thead className="sticky top-0 bg-neutral-50">
                        <tr className="text-left text-neutral-600">
                          <th className="px-3 py-2 font-medium">Mi</th>
                          <th className="px-3 py-2 font-medium">Licenses</th>
                          <th className="px-3 py-2 font-medium">Address key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {rankedAddresses.map((row) => (
                          <tr key={row.addressKey} className="text-neutral-800">
                            <td className="px-3 py-2 font-mono tabular-nums">{row.distance_miles.toFixed(4)}</td>
                            <td className="px-3 py-2 font-medium">{row.license_count}</td>
                            <td className="px-3 py-2 text-xs break-all text-neutral-600">
                              {row.addressKey.replace(/\|/g, " · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className="pb-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
          >
            ← Back to Markets
          </Link>
        </div>
      </div>
    </div>
  );
}
