import type { ReactNode } from "react";
import type { EnrichedBeautyZoneMember } from "@/lib/markets";

const GRAY_BADGE_TITLE =
  "Supplemental identity hints from gray-pin resolution (search-derived). Not primary site_identity truth — verify before use.";

export function memberHasGrayResolution(member: Pick<EnrichedBeautyZoneMember, "gray_resolution_matched">): boolean {
  return member.gray_resolution_matched === true;
}

/** Compact table badge when gray-resolution merge matched this member. */
export function GrayResolutionBadge({ member }: { member: Pick<EnrichedBeautyZoneMember, "gray_resolution_matched"> }) {
  if (!memberHasGrayResolution(member)) return null;
  return (
    <span
      className="inline-flex shrink-0 rounded border border-violet-400/90 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900"
      title={GRAY_BADGE_TITLE}
    >
      Resolved
    </span>
  );
}

/** Member detail: gray resolution evidence (only when matched). */
export function GrayResolutionSection({ member }: { member: EnrichedBeautyZoneMember }) {
  if (!memberHasGrayResolution(member)) return null;

  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: "Score", value: member.gray_resolution_score ?? "—" },
    { label: "Match name", value: member.gray_resolution_match_name?.trim() || "—" },
    {
      label: "Match URL",
      value: member.gray_resolution_match_url?.trim() ? (
        <a
          href={member.gray_resolution_match_url!}
          className="text-sky-700 underline-offset-2 hover:underline break-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          {member.gray_resolution_match_url}
        </a>
      ) : (
        "—"
      ),
    },
    {
      label: "Instagram (supplemental)",
      value: member.gray_resolution_instagram_url?.trim() ? (
        <a
          href={member.gray_resolution_instagram_url!}
          className="text-sky-700 underline-offset-2 hover:underline break-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          {member.gray_resolution_instagram_url}
        </a>
      ) : (
        "—"
      ),
    },
    { label: "Booking provider (supplemental)", value: member.gray_resolution_booking_provider?.trim() || "—" },
    { label: "Source query", value: member.gray_resolution_source_query?.trim() || "—" },
    { label: "Notes", value: member.gray_resolution_match_notes?.trim() || "—" },
  ];

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">Gray resolution</div>
      <p className="mt-1 text-xs text-violet-900/80">
        Supplemental candidates from gray-pin workflow. Does not replace Presence or Path enrichment.
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{row.label}</dt>
            <dd className="mt-0.5 text-neutral-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
