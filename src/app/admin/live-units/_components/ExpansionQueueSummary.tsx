"use client";

type Props = {
  /** e.g. "Current filters (Expansion view)" */
  scopeLabel: string;
  expansionRows: number;
  igMissing: number;
  upgradeable: number;
  wouldMoveToHigh: number;
};

/**
 * Expansion layer summary — counts are for the current filtered row set in Expansion mode unless noted.
 */
export default function ExpansionQueueSummary({
  scopeLabel,
  expansionRows,
  igMissing,
  upgradeable,
  wouldMoveToHigh,
}: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm">
      <div className="font-semibold">Expansion Layer — Pre-validated candidates (60–69)</div>
      <p className="mt-0.5 text-[11px] text-amber-900/90">{scopeLabel}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-amber-800/90">Expansion rows</dt>
          <dd className="font-semibold tabular-nums text-amber-950">{expansionRows}</dd>
        </div>
        <div>
          <dt className="text-amber-800/90">IG missing</dt>
          <dd className="font-semibold tabular-nums text-amber-950">{igMissing}</dd>
        </div>
        <div>
          <dt className="text-amber-800/90">Upgradeable now</dt>
          <dd className="font-semibold tabular-nums text-amber-950">{upgradeable}</dd>
        </div>
        <div>
          <dt className="text-amber-800/90">Would move to ≥70</dt>
          <dd className="font-semibold tabular-nums text-amber-950">{wouldMoveToHigh}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] leading-snug text-amber-900/85">
        Upgradeable = positive client-side nudge from existing IG, booking, DORA, identity, or operator signals (capped). No new
        fetches.
      </p>
    </div>
  );
}
