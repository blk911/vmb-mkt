"use client";

import { useState } from "react";
import type { PromoteToOutreachInput } from "@/lib/unknown-resolver/resolver-storage";
import type { EnrichedResolverRow, ResolverDecision } from "@/lib/unknown-resolver/resolver-types";
import UnknownResolverDetailPanel from "./UnknownResolverDetailPanel";
import ResolverOperatorActions from "./ResolverOperatorActions";
import ResolverPromoteSection from "./ResolverPromoteSection";
import ResolverRecommendationBadge from "./ResolverRecommendationBadge";
import ResolverScoreBadge from "./ResolverScoreBadge";

type Props = {
  row: EnrichedResolverRow;
  onUpdateDecision: (recordId: string, decision: ResolverDecision, note: string | null) => void;
  onPromoteToOutreach: (recordId: string, input: PromoteToOutreachInput) => void;
};

export default function UnknownResolverQueueCard({ row, onUpdateDecision, onPromoteToOutreach }: Props) {
  const [open, setOpen] = useState(false);
  const { record, score, evidenceCount } = row;
  const displayName = record.sourceName ?? record.normalizedName ?? "(unnamed)";
  const addrLine = [record.address, record.city].filter(Boolean).join(", ") || "—";

  return (
    <article className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-neutral-50"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">{displayName}</span>
            <ResolverScoreBadge score={score.finalScore} />
            <ResolverRecommendationBadge recommendation={score.recommendation} label={`SYS ${score.recommendation}`} />
            {record.operatorDecision ? (
              <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-900">
                OP {record.operatorDecision}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-neutral-400">Undecided</span>
            )}
            {record.promotedAt ? (
              <span className="rounded border border-sky-400 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                Outreach
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-neutral-600">{addrLine}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500">
            <span>Ring {record.ring != null ? `${record.ring} mi` : "—"}</span>
            <span>·</span>
            <span>{record.distanceMiles != null ? `${record.distanceMiles.toFixed(2)} mi out` : "—"}</span>
            <span>·</span>
            <span>{evidenceCount} evidence</span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-sky-700">{open ? "▼" : "▶"}</span>
      </button>

      {open ? (
        <>
          <UnknownResolverDetailPanel row={row} />
          <div className="border-t border-neutral-200 px-3 py-3">
            <ResolverOperatorActions
              key={`${record.id}-${record.updatedAt}`}
              recordId={record.id}
              initialDecision={record.operatorDecision}
              initialNote={record.operatorNote}
              onSave={onUpdateDecision}
            />
            <ResolverPromoteSection record={record} onPromote={(input) => onPromoteToOutreach(record.id, input)} />
          </div>
        </>
      ) : null}
    </article>
  );
}
