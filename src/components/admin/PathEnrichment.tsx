import type { ReactNode } from "react";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";

const PATH_BADGE_TITLE =
  "Supplemental corroboration from path-based enrichment (cluster-assisted). Not primary site_identity truth — use alongside Presence.";

export function memberHasPathEnrichment(member: Pick<EnrichedBeautyZoneMember, "path_enrichment_matched">): boolean {
  return member.path_enrichment_matched === true;
}

/** Compact table/card badge when path merge matched this member. */
export function PathEnrichmentBadge({ member }: { member: Pick<EnrichedBeautyZoneMember, "path_enrichment_matched"> }) {
  if (!memberHasPathEnrichment(member)) return null;
  return (
    <span
      className="inline-flex shrink-0 rounded border border-slate-300/80 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800"
      title={PATH_BADGE_TITLE}
    >
      Path
    </span>
  );
}

/** Member detail: path enrichment evidence (only when matched). */
export function PathEnrichmentSection({ member }: { member: EnrichedBeautyZoneMember }) {
  if (!memberHasPathEnrichment(member)) return null;

  const ig =
    (member.path_enrichment_instagram_url?.trim() && member.path_enrichment_instagram_url) ||
    (member.path_enrichment_instagram_handle?.trim() ? `@${member.path_enrichment_instagram_handle.replace(/^@/, "")}` : "");

  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: "Source type", value: member.path_enrichment_best_source_type ?? "—" },
    { label: "Confidence", value: member.path_enrichment_best_confidence ?? "—" },
    {
      label: "Instagram",
      value: ig ? (
        member.path_enrichment_instagram_url?.trim() ? (
          <a
            href={member.path_enrichment_instagram_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-700 underline-offset-2 hover:underline"
          >
            {ig}
          </a>
        ) : (
          ig
        )
      ) : (
        "—"
      ),
    },
    { label: "Phone", value: member.path_enrichment_phone?.trim() || "—" },
    { label: "Website (discovered)", value: member.path_enrichment_website_url?.trim() || "—" },
    { label: "Booking provider", value: member.path_enrichment_booking_provider?.trim() || "—" },
    {
      label: "Booking URL",
      value: member.path_enrichment_booking_url?.trim() ? (
        <a
          href={member.path_enrichment_booking_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sky-700 underline-offset-2 hover:underline"
        >
          {member.path_enrichment_booking_url}
        </a>
      ) : (
        "—"
      ),
    },
    {
      label: "Source URL",
      value: member.path_enrichment_source_url?.trim() ? (
        <a
          href={member.path_enrichment_source_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sky-700 underline-offset-2 hover:underline"
        >
          {member.path_enrichment_source_url}
        </a>
      ) : (
        "—"
      ),
    },
  ];

  if (member.path_enrichment_match_count != null && member.path_enrichment_match_count > 1) {
    rows.push({ label: "Match count", value: String(member.path_enrichment_match_count) });
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Path enrichment</div>
      <p className="mt-1 text-xs text-slate-600">
        Supplemental corroboration from constrained path discovery —{" "}
        <strong className="font-semibold text-slate-800">not</strong> primary site_identity truth. Compare with Presence
        above.
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-2">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="text-neutral-900">{value}</dd>
          </div>
        ))}
      </dl>
      {member.path_enrichment_match_notes?.trim() ? (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-700">{member.path_enrichment_match_notes}</p>
        </div>
      ) : null}
    </div>
  );
}
