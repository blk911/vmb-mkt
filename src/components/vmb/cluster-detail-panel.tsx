import type { ReactNode } from "react";
import type { Cluster } from "@/lib/cluster/types";
import { diagnosticLabel } from "@/lib/cluster/diagnostics";
import EvidenceBadges from "./evidence-badges";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        {typeof count === "number" ? <div className="text-xs text-neutral-500">{count} rows</div> : null}
      </div>
      {children}
    </div>
  );
}

function SourceList({
  items,
}: {
  items: { name: string; note: string }[];
}) {
  if (items.length === 0) {
    return <div className="text-sm text-neutral-500">No records in this section.</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={`row-${idx}`} className="rounded-lg border border-neutral-100 p-3">
          <div className="text-sm font-medium text-neutral-900">{item.name}</div>
          <div className="mt-1 text-xs text-neutral-500">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

export default function ClusterDetailPanel({ cluster }: { cluster: Cluster | null }) {
  if (!cluster) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        Select a shop cluster to inspect details.
      </div>
    );
  }

  const mergedGoogle = cluster.google.filter((x) => x.decision === "merged");
  const mergedDoraShops = cluster.doraShops.filter((x) => x.decision === "merged");
  const mergedTechs = cluster.doraPeople.filter((x) => x.decision === "merged");
  const candidateTechs = cluster.doraPeople.filter((x) => x.decision === "candidate_only");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="text-xl font-semibold text-neutral-900">{cluster.displayName}</div>
        <div className="mt-1 text-sm text-neutral-600">
          {cluster.displayAddress || cluster.headEntity.address || "Address unavailable"}
        </div>
        <div className="mt-1 text-sm text-neutral-500">
          {cluster.headEntity.category || "unknown"} · {cluster.corridor || cluster.zone || "No zone"}
        </div>

        <EvidenceBadges cluster={cluster} />

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Merge confidence</div>
            <div className="mt-1 font-semibold text-neutral-900">{cluster.confidence}</div>
          </div>
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Google storefronts</div>
            <div className="mt-1 font-semibold text-neutral-900">{mergedGoogle.length}</div>
          </div>
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">DORA shops</div>
            <div className="mt-1 font-semibold text-neutral-900">{mergedDoraShops.length}</div>
          </div>
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">Attached techs</div>
            <div className="mt-1 font-semibold text-neutral-900">{mergedTechs.length}</div>
          </div>
        </div>
      </div>

      <Section title="Why this was merged" count={cluster.diagnostics.length}>
        <div className="flex flex-wrap gap-2">
          {cluster.diagnostics.map((d) => (
            <span
              key={d}
              className="inline-flex rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-700"
            >
              {diagnosticLabel(d)}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Alternate / related names" count={cluster.altNames.length}>
        <SourceList
          items={cluster.altNames.map((name, i) => ({
            name,
            note: i === 0 ? "Primary display / anchor names in this cluster" : "Observed related name in merged cluster",
          }))}
        />
      </Section>

      <Section title="Google storefront records" count={mergedGoogle.length}>
        <SourceList
          items={mergedGoogle.map((x) => ({
            name: x.entity.name,
            note: `Merged · score ${x.breakdown.score} · ${x.breakdown.distanceMiles.toFixed(2)} mi`,
          }))}
        />
      </Section>

      <Section title="DORA shop records" count={mergedDoraShops.length}>
        <SourceList
          items={mergedDoraShops.map((x) => ({
            name: x.entity.name,
            note: `Merged · score ${x.breakdown.score} · license ${x.entity.licenseId || "n/a"}`,
          }))}
        />
      </Section>

      <Section title="Confirmed techs" count={mergedTechs.length}>
        <SourceList
          items={mergedTechs.map((x) => ({
            name: x.entity.name,
            note: `Attached · score ${x.breakdown.score}`,
          }))}
        />
      </Section>

      <Section title="Likely / candidate techs" count={candidateTechs.length}>
        <SourceList
          items={candidateTechs.map((x) => ({
            name: x.entity.name,
            note: `Candidate only · score ${x.breakdown.score}`,
          }))}
        />
      </Section>
    </div>
  );
}
