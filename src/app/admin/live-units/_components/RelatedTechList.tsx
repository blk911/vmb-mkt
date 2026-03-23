"use client";

import type { ClusterModeRow, ClusterReasonTag, RelatedRowMatch } from "@/lib/live-units/cluster-mode-types";
import type { DerivedEntityDisplayState } from "@/lib/live-units/entity-display-types";
import type { DerivedServiceSignals } from "@/lib/live-units/service-signal-types";
import EntityKindBadge from "@/app/admin/live-units/_components/EntityKindBadge";
import ServiceSignalChips from "@/app/admin/live-units/_components/ServiceSignalChips";
import PlatformSignalBadges from "@/app/admin/live-units/_components/PlatformSignalBadges";

const TAG_SHORT: Partial<Record<ClusterReasonTag, string>> = {
  same_building: "same area",
  service_overlap: "services",
  tech_near_salon: "near salon",
  shared_name: "name",
  validated_operator_overlap: "operator roster",
  same_zone: "zone",
  suite_or_tech_context: "suite/tech",
};

export type RelatedTechRowProps = {
  row: ClusterModeRow;
  match: RelatedRowMatch;
  entityDisplay: DerivedEntityDisplayState;
  serviceSig: DerivedServiceSignals;
};

type Props = {
  items: RelatedTechRowProps[];
  className?: string;
};

export default function RelatedTechList({ items, className = "" }: Props) {
  if (items.length === 0) {
    return <p className="text-[11px] text-slate-500">No related rows grouped with this anchor (under-grouping is intentional).</p>;
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map(({ row, match, entityDisplay, serviceSig }) => (
        <li
          key={row.live_unit_id}
          className="rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2 text-xs text-slate-800"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{row.name_display}</span>
            <EntityKindBadge label={entityDisplay.liveLabel} />
            <span className="text-[10px] tabular-nums text-slate-500">rel {match.relationshipScore}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ServiceSignalChips signals={serviceSig.serviceSignals} />
            <PlatformSignalBadges platformSignals={row.platformSignals} />
          </div>
          {match.reasonTags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {match.reasonTags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600"
                >
                  {TAG_SHORT[t] ?? t.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
