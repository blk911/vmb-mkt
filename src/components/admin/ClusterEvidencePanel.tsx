"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GrayResolutionBadge } from "@/components/admin/GrayResolution";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { formatBookingProviderLabel } from "@/components/admin/PresenceBadges";
import type { ClusterActiveMetrics } from "@/app/admin/markets/_lib/marketsClusterActive";
import { memberHasActivePresence } from "@/app/admin/markets/_lib/marketsActiveRank";
import { buildMemberDetailPath, type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";

function compareClusterEvidenceMembers(a: EnrichedBeautyZoneMember, b: EnrichedBeautyZoneMember): number {
  const anch = (b.is_anchor ? 1 : 0) - (a.is_anchor ? 1 : 0);
  if (anch !== 0) return anch;
  const act = (memberHasActivePresence(b) ? 1 : 0) - (memberHasActivePresence(a) ? 1 : 0);
  if (act !== 0) return act;
  const path =
    (b.path_enrichment_matched === true ? 1 : 0) - (a.path_enrichment_matched === true ? 1 : 0);
  if (path !== 0) return path;
  const gray =
    (b.gray_resolution_matched === true ? 1 : 0) - (a.gray_resolution_matched === true ? 1 : 0);
  if (gray !== 0) return gray;
  const pa = a.priority_score ?? 0;
  const pb = b.priority_score ?? 0;
  if (pb !== pa) return pb - pa;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function igSnippet(m: EnrichedBeautyZoneMember): string | null {
  const h = m.instagram_handle?.trim();
  if (h) return h.startsWith("@") ? h : `@${h}`;
  const u = m.instagram_url?.trim();
  if (u) return u.length > 42 ? `${u.slice(0, 40)}…` : u;
  return null;
}

type Props = {
  members: EnrichedBeautyZoneMember[];
  metrics: ClusterActiveMetrics;
  marketsUrlState: MarketsUrlState;
};

export function ClusterEvidencePanel({ members, metrics, marketsUrlState }: Props) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...members].sort(compareClusterEvidenceMembers), [members]);

  return (
    <div className="mt-2 border-t border-neutral-200/80 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-[11px] font-semibold text-sky-700 underline-offset-2 hover:underline"
      >
        {open ? "Hide evidence" : "View evidence"}
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50/90 px-2.5 py-2 shadow-inner">
          <p className="text-[10px] font-mono leading-snug text-neutral-700 tabular-nums">
            {metrics.total_member_count} members · Active {metrics.active_member_count} · Path{" "}
            {metrics.path_enriched_member_count}
            {metrics.resolved_member_count > 0 ? ` · Resolved ${metrics.resolved_member_count}` : ""} · IG{" "}
            {metrics.instagram_member_count} · Booking {metrics.booking_member_count} · Opp{" "}
            {metrics.cluster_opportunity_score}
          </p>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-0.5">
            {sorted.map((m) => {
              const active = memberHasActivePresence(m);
              const ig = igSnippet(m);
              const bp = m.booking_provider?.trim();
              const pst = m.path_enrichment_best_source_type?.trim();
              const pcf = m.path_enrichment_best_confidence?.trim();
              return (
                <li key={m.location_id} className="border-b border-neutral-200/80 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <Link
                      href={buildMemberDetailPath(m.location_id, marketsUrlState)}
                      className="min-w-0 max-w-[12rem] truncate text-xs font-semibold text-sky-700 underline-offset-2 hover:underline sm:max-w-none"
                      title={m.name}
                    >
                      {m.name}
                    </Link>
                    {active ? (
                      <span className="inline-flex shrink-0 rounded bg-teal-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-900">
                        Active
                      </span>
                    ) : null}
                    <PathEnrichmentBadge member={m} />
                    <GrayResolutionBadge member={m} />
                    {m.is_anchor ? (
                      <span className="inline-flex shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-900">
                        Anchor
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[10px] leading-snug text-neutral-600">
                    {ig || bp ? (
                      <>
                        {ig ? <span>IG: {ig}</span> : null}
                        {ig && bp ? <span> · </span> : null}
                        {bp ? <span>Book: {formatBookingProviderLabel(bp)}</span> : null}
                      </>
                    ) : (
                      <span className="text-neutral-400">No IG / booking on row</span>
                    )}
                  </div>
                  {(pst || pcf) && (
                    <div className="mt-0.5 text-[10px] text-neutral-500">
                      {pst ? <span>Path: {pst}</span> : null}
                      {pst && pcf ? <span> · </span> : null}
                      {pcf ? <span>{pcf}</span> : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
