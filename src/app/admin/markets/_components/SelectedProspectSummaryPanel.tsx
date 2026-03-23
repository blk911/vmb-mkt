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

/** Compact storefront / suite hint from subtype text for the metadata line. */
function venueSignalLabel(subtype: string): string {
  const t = subtype.trim();
  if (!t) return "—";
  if (/\bsuite\b|salon suite|suite\/|booth|studio suite/i.test(t)) return "Suite";
  if (/storefront|inline|strip mall|retail strip/i.test(t.toLowerCase())) return "Storefront";
  return t.length > 28 ? `${t.slice(0, 26)}…` : t;
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

  const metaLine = `${row.distance_miles.toFixed(2)} mi · ${m.category} · ${venueSignalLabel(m.subtype)}`;

  const scoresLine = [
    `Nearby ${row.nearby_prospect_score}`,
    `Outreach ${row.outreach_score}`,
    row.cluster_opportunity_score != null ? `Cluster opp ${row.cluster_opportunity_score}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!visible) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-neutral-800">{m.name}</span>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Open summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-xl rounded-xl border border-sky-200/90 bg-white p-3 pt-3 pr-10 shadow-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Close summary"
      >
        <span className="text-lg font-light leading-none" aria-hidden>
          ×
        </span>
      </button>

      <div className="min-w-0 space-y-1.5">
        <h3 className="pr-1 text-base font-semibold leading-snug tracking-tight text-neutral-900">{m.name}</h3>
        <p className="text-sm text-neutral-600">{metaLine}</p>
        {lowSignal ? (
          <p className="text-sm leading-snug text-neutral-700">
            Low signal — no anchor / active / path / resolved classification
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-neutral-700">{prospectTypeLabel(kind)}</span>
          </p>
        )}
        <p className="text-sm leading-snug text-neutral-600">{outreachLabel}</p>
        <p className="text-sm tabular-nums text-neutral-800">{scoresLine}</p>
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
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      <dl className="mt-2 grid gap-2 text-sm text-neutral-800 sm:grid-cols-2">
        {ig ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Instagram</dt>
            <dd className="mt-0.5 break-all">{ig}</dd>
          </div>
        ) : null}
        {bookingLabel || bookingUrl ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking</dt>
            <dd className="mt-0.5">
              {bookingLabel ?? "—"}
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1.5 text-sky-700 underline-offset-2 hover:underline"
                >
                  Link
                </a>
              ) : null}
            </dd>
          </div>
        ) : null}
        {phone ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Phone</dt>
            <dd className="mt-0.5">{phone}</dd>
          </div>
        ) : null}
      </dl>

      {expanded ? (
        <div className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Address</span>
            <p className="mt-1 leading-snug">{[m.address, m.city, m.state, m.zip].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Evidence</span>
            <p className="mt-1 leading-snug text-neutral-700">{evidenceSummary(row)}</p>
          </div>
          <Link
            href={detailHref}
            className="mt-3 inline-block text-sm font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            Open detail page →
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">Use “More” for address and evidence. Full listing is on the detail page.</p>
      )}
    </div>
  );
}
