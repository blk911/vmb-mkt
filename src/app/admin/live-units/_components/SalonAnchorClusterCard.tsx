"use client";

import { useState } from "react";
import type { SalonAnchorCluster } from "@/lib/live-units/cluster-mode-types";
import type { ClusterModeRow } from "@/lib/live-units/cluster-mode-types";
import type { DerivedEntityDisplayState } from "@/lib/live-units/entity-display-types";
import type { DerivedServiceSignals } from "@/lib/live-units/service-signal-types";
import EntityKindBadge from "@/app/admin/live-units/_components/EntityKindBadge";
import ServiceSignalChips from "@/app/admin/live-units/_components/ServiceSignalChips";
import PlatformSignalBadges from "@/app/admin/live-units/_components/PlatformSignalBadges";
import EntryOptionChips from "@/app/admin/live-units/_components/EntryOptionChips";
import ClusterStrengthBadge from "@/app/admin/live-units/_components/ClusterStrengthBadge";
import RelatedTechList, { type RelatedTechRowProps } from "@/app/admin/live-units/_components/RelatedTechList";

function zoneLabel(zoneId: string | null, zoneName: string | null): string {
  if (zoneName && zoneName !== "No zone") return zoneName;
  if (zoneId) return zoneId;
  return "—";
}

type Props = {
  cluster: SalonAnchorCluster;
  anchorRow: ClusterModeRow;
  anchorEntityDisplay: DerivedEntityDisplayState;
  anchorServiceSig: DerivedServiceSignals;
  relatedItems: RelatedTechRowProps[];
  onOpenAnchor: () => void;
};

export default function SalonAnchorClusterCard({
  cluster,
  anchorRow,
  anchorEntityDisplay,
  anchorServiceSig,
  relatedItems,
  onOpenAnchor,
}: Props) {
  const [open, setOpen] = useState(true);

  const zn = anchorRow.raw_snippets?.google?.zone_name ?? null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50/80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{anchorRow.name_display}</h3>
            <EntityKindBadge label={anchorEntityDisplay.liveLabel} />
            <ClusterStrengthBadge strength={cluster.clusterStrength} />
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            {zoneLabel(cluster.zoneId, zn)} · {cluster.relatedUnitIds.length} related · {cluster.validatedOperatorCount}{" "}
            validated ops · {cluster.platformSignalCount} booking signal{cluster.platformSignalCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{open ? "▼" : "▶"}</span>
      </button>

      {open ? (
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <ServiceSignalChips signals={anchorServiceSig.serviceSignals} />
            <PlatformSignalBadges platformSignals={anchorRow.platformSignals} />
          </div>
          <p className="text-xs leading-snug text-slate-700">{cluster.operatorSummary}</p>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Entry hints</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <EntryOptionChips options={anchorEntityDisplay.entryOptions} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenAnchor}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 transition hover:bg-sky-100"
            >
              Focus anchor in panel
            </button>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Related rows</div>
            <div className="mt-1.5">
              <RelatedTechList items={relatedItems} />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
