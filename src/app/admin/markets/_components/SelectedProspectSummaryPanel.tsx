"use client";

import Link from "next/link";
import { GrayResolutionBadge } from "@/components/admin/GrayResolution";
import { PathEnrichmentBadge } from "@/components/admin/PathEnrichment";
import { formatBookingProviderLabel } from "@/components/admin/PresenceBadges";
import { buildMemberDetailPath, type MarketsUrlState } from "@/app/admin/markets/_lib/marketsUrlState";
import {
  classifyProspect,
  prospectTypeLabel,
  type NearbyProspectRow,
} from "@/app/admin/markets/_lib/salesTargetMapHelpers";

function phoneLine(m: NearbyProspectRow["member"]): string | null {
  const raw = m as Record<string, unknown>;
  const p = raw.phone;
  if (typeof p === "string" && p.trim()) return p.trim();
  if (m.path_enrichment_phone?.trim()) return m.path_enrichment_phone.trim();
  if (m.anchor_directory_phone?.trim()) return m.anchor_directory_phone.trim();
  return null;
}

function evidenceSummary(row: NearbyProspectRow): string {
  const m = row.member;
  const parts: string[] = [];
  if (m.path_enrichment_matched === true) {
    const st = m.path_enrichment_best_source_type?.trim();
    const cf = m.path_enrichment_best_confidence?.trim();
    parts.push(["Path enrichment", st, cf].filter(Boolean).join(" · "));
  }
  if (m.gray_resolution_matched === true) {
    const q = m.gray_resolution_source_query?.trim();
    const n = m.gray_resolution_match_notes?.trim();
    if (q || n) parts.push(["Gray resolution", q, n].filter(Boolean).join(" · "));
    else parts.push("Gray resolution (matched)");
  }
  return parts.length ? parts.join(" · ") : "No supplemental path or gray resolution on this row.";
}

export type SelectedProspectSummaryPanelProps = {
  row: NearbyProspectRow | null;
  /** When false, panel body is hidden but selection may remain (use reopen bar). */
  visible: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  onOpen: () => void;
  marketsUrlState: MarketsUrlState;
};

export function SelectedProspectSummaryPanel({
  row,
  visible,
  expanded,
  onToggleExpanded,
  onClose,
  onOpen,
  marketsUrlState,
}: SelectedProspectSummaryPanelProps) {
  if (!row) return null;

  const m = row.member;
  const kind = classifyProspect(row);
  const lowSignal = kind === "fallback";
  const detailHref = buildMemberDetailPath(m.location_id, marketsUrlState);
  const phone = phoneLine(m);
  const ig =
    m.instagram_handle?.trim() ||
    (m.instagram_url?.trim() ? m.instagram_url.trim() : null);
  const bookingLabel = m.booking_provider?.trim() ? formatBookingProviderLabel(m.booking_provider.trim()) : null;
  const bookingUrl = m.booking_url?.trim();

  const outreachLabel = row.member_has_direct_outreach
    ? "Direct outreach (phone / link hub / path phone)"
    : "No direct outreach signals";

  if (!visible) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-medium text-neutral-700">{m.name}</span>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Open summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-neutral-900">{m.name}</h3>
            <span className="text-[11px] tabular-nums text-neutral-500">{row.distance_miles.toFixed(2)} mi</span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-600">
            {m.category} · {m.subtype}
          </p>
          {lowSignal ? (
            <p className="mt-1 text-[11px] font-semibold text-neutral-600">Low signal — no anchor / active / path / resolved classification</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
          >
            {expanded ? "Less" : "More"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {m.is_anchor ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Anchor</span>
        ) : null}
        {row.active ? (
          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900">Active</span>
        ) : null}
        <PathEnrichmentBadge member={m} />
        <GrayResolutionBadge member={m} />
        {!lowSignal ? (
          <span className="text-[10px] text-neutral-500" title="Map marker class">
            {prospectTypeLabel(kind)}
          </span>
        ) : null}
      </div>

      <dl className="mt-2 grid gap-1 text-[11px] text-neutral-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-neutral-500">Outreach</dt>
          <dd>{outreachLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-neutral-500">Scores</dt>
          <dd className="tabular-nums">
            Nearby {row.nearby_prospect_score} · Outreach {row.outreach_score}
            {row.cluster_opportunity_score != null ? ` · Cluster opp ${row.cluster_opportunity_score}` : ""}
          </dd>
        </div>
        {ig ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-neutral-500">Instagram</dt>
            <dd className="break-all">{ig}</dd>
          </div>
        ) : null}
        {bookingLabel || bookingUrl ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-neutral-500">Booking</dt>
            <dd>
              {bookingLabel ?? "—"}
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-sky-700 underline-offset-2 hover:underline"
                >
                  Link
                </a>
              ) : null}
            </dd>
          </div>
        ) : null}
        {phone ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-neutral-500">Phone</dt>
            <dd>{phone}</dd>
          </div>
        ) : null}
      </dl>

      {expanded ? (
        <div className="mt-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-700">
          <div>
            <span className="font-semibold text-neutral-500">Address</span>
            <p className="mt-0.5">{[m.address, m.city, m.state, m.zip].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div className="mt-2">
            <span className="font-semibold text-neutral-500">Evidence</span>
            <p className="mt-0.5 leading-snug text-neutral-600">{evidenceSummary(row)}</p>
          </div>
          <Link
            href={detailHref}
            className="mt-2 inline-block text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            Open detail page →
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-neutral-400">Use “More” for address and evidence. Full listing is on the detail page.</p>
      )}
    </div>
  );
}
