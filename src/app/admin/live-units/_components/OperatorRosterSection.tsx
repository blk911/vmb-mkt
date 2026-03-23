"use client";

import type { SurfacedOperator } from "@/lib/live-units/operator-extraction-types";
import OperatorConfidenceBadge from "./OperatorConfidenceBadge";
import OperatorSourceBadges from "./OperatorSourceBadges";

type Props = {
  businessLabel: string | null;
  operators: SurfacedOperator[];
  className?: string;
};

/**
 * Attached operators for a validated business — Tier A only; hidden when empty.
 */
export default function OperatorRosterSection({ businessLabel, operators, className = "" }: Props) {
  if (operators.length === 0) return null;

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${className}`}
      aria-label="Validated attached operators"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Validated providers</h3>
        {businessLabel ? <span className="text-[10px] text-slate-500">{businessLabel}</span> : null}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Anchored to this business only. Sourced from trusted surfaces (site / official IG).
      </p>
      <ul className="mt-2 space-y-2">
        {operators.map((op) => (
          <li
            key={op.id}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-sm text-neutral-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{op.operatorName}</span>
              {op.roleLabel ? <span className="text-xs text-neutral-600">{op.roleLabel}</span> : null}
              <OperatorConfidenceBadge />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {op.instagramHandle ? (
                <a
                  href={op.profileUrl || `https://www.instagram.com/${op.instagramHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-sky-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{op.instagramHandle}
                </a>
              ) : op.profileUrl ? (
                <a
                  href={op.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-sky-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Profile
                </a>
              ) : null}
              <OperatorSourceBadges sourceTypes={op.sourceTypes} />
            </div>
            {op.evidenceSnippets[0] ? (
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-600 line-clamp-2" title={op.evidenceSnippets.join(" ")}>
                {op.evidenceSnippets[0]}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
