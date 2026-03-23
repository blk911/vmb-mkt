"use client";

import Link from "next/link";
import type { BeautyZone } from "@/lib/markets";
import type { ZoneBuildSummary } from "@/lib/markets/zone-build-types";
import { getZoneDisplayLabel } from "@/lib/geo/target-zones";
import ZoneMaturityBadge from "./ZoneMaturityBadge";
import type { ZoneMaturity } from "@/lib/geo/target-zones";

type Props = {
  zone: BeautyZone;
  maturity: ZoneMaturity;
  summary: ZoneBuildSummary;
  onContinueWorkPacket: () => void;
};

export default function ZoneBuildModePanel({ zone, maturity, summary, onContinueWorkPacket }: Props) {
  const label = getZoneDisplayLabel(zone.zone_id);

  return (
    <section className="rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/90 to-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-900">Build mode</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{label}</h2>
            <ZoneMaturityBadge maturity={maturity} />
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-600" title={zone.market}>
            {zone.market}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-700">
        This zone is defined geographically, but may not yet be fully surveyed into an operational work packet. Low counts
        here often mean <span className="font-medium">not yet stitched</span>, not “no opportunity.”
      </p>

      <p className="mt-2 text-xs text-neutral-600">{summary.narrativeLine}</p>

      <div className="mt-3 grid gap-1.5 rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-[11px] text-neutral-800 sm:grid-cols-2">
        <div>
          <span className="text-neutral-500">Stitched members </span>
          <span className="font-semibold tabular-nums">{summary.stitchedMemberCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">Clusters </span>
          <span className="font-semibold tabular-nums">{summary.clusterSeedCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">DORA signal (rows) </span>
          <span className="font-semibold tabular-nums">{summary.membersWithDoraSignalCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">DORA license refs (sum) </span>
          <span className="font-semibold tabular-nums">{summary.doraLicenseRefsTotal}</span>
        </div>
        <div>
          <span className="text-neutral-500">Google-sourced rows </span>
          <span className="font-semibold tabular-nums">{summary.googleSourceMemberCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">Cold identity (no IG/booking) </span>
          <span className="font-semibold tabular-nums">{summary.coldIdentityMemberCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">Gray unresolved </span>
          <span className="font-semibold tabular-nums">{summary.grayResolutionUnmatchedCount}</span>
        </div>
        <div>
          <span className="text-neutral-500">Approved live units (linked) </span>
          <span className="font-semibold tabular-nums">{summary.approvedLiveUnitsInZoneCount}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinueWorkPacket}
          className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50"
        >
          Continue survey (work packet)
        </button>
        <Link
          href="/admin/markets/unknown-resolver"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
        >
          Unknown resolver
        </Link>
        <Link
          href="/admin/markets/outreach-queue"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
        >
          Outreach queue
        </Link>
        <Link
          href="/admin/live-units"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
        >
          Live Units
        </Link>
      </div>
    </section>
  );
}
