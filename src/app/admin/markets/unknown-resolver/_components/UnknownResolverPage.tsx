"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildHouseCleaningQueries } from "@/lib/unknown-resolver/resolver-query-generator";
import { mergeStoredScoreBreakdown, scoreHouseCleaningRecord } from "@/lib/unknown-resolver/resolver-score";
import {
  applyUnknownResolverFilters,
  DEFAULT_UNKNOWN_RESOLVER_FILTERS,
  sortUnknownResolverQueue,
} from "@/lib/unknown-resolver/resolver-filters";
import type { EnrichedResolverRow, ResolverDecision, UnknownResolverFiltersState } from "@/lib/unknown-resolver/resolver-types";
import {
  hydrateQueueScores,
  loadUnknownResolverCandidates,
  loadUnknownResolverQueue,
  promoteToOutreach,
  saveOperatorDecision,
  type PromoteToOutreachInput,
} from "@/lib/unknown-resolver/resolver-storage";
import UnknownResolverFilters from "./UnknownResolverFilters";
import UnknownResolverQueue from "./UnknownResolverQueue";

/** Queue rows include `zones` / `primaryZone` from resolver-storage (lat/lng → TARGET_ZONES). */
function buildEnriched(records: ReturnType<typeof loadUnknownResolverQueue>): EnrichedResolverRow[] {
  return records.map((record) => {
    const candidates = loadUnknownResolverCandidates(record.id);
    const querySet = buildHouseCleaningQueries(record);
    const computed = scoreHouseCleaningRecord(record, candidates);
    const score = mergeStoredScoreBreakdown(record, computed);
    return {
      record,
      querySet,
      candidates,
      score,
      evidenceCount: candidates.length,
    };
  });
}

export default function UnknownResolverPage() {
  const [records, setRecords] = useState(() => loadUnknownResolverQueue());
  const [filters, setFilters] = useState<UnknownResolverFiltersState>(DEFAULT_UNKNOWN_RESOLVER_FILTERS);

  useEffect(() => {
    hydrateQueueScores();
    setRecords(loadUnknownResolverQueue());
  }, []);

  const fullEnriched = useMemo(() => buildEnriched(records), [records]);

  const stats = useMemo(() => {
    const total = fullEnriched.length;
    const yesRec = fullEnriched.filter((r) => r.score.recommendation === "yes").length;
    const reviewRec = fullEnriched.filter((r) => r.score.recommendation === "review").length;
    const noRec = fullEnriched.filter((r) => r.score.recommendation === "no").length;
    const operatorConfirmed = fullEnriched.filter((r) => r.record.operatorDecision != null).length;
    const remainingUnreviewed = fullEnriched.filter((r) => r.record.operatorDecision == null).length;
    return {
      total,
      yesRec,
      reviewRec,
      noRec,
      operatorConfirmed,
      remainingUnreviewed,
    };
  }, [fullEnriched]);

  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of records) {
      const c = r.city?.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [records]);

  const ringOptions = useMemo(() => ["all", "0.25", "0.5", "1"], []);

  const filteredSorted = useMemo(() => {
    const filtered = applyUnknownResolverFilters(fullEnriched, filters);
    return sortUnknownResolverQueue(filtered);
  }, [fullEnriched, filters]);

  const onUpdateDecision = useCallback((recordId: string, decision: ResolverDecision, note: string | null) => {
    const updated = saveOperatorDecision(recordId, decision, note);
    if (updated) {
      setRecords(loadUnknownResolverQueue());
    }
  }, []);

  const onPromoteToOutreach = useCallback((recordId: string, input: PromoteToOutreachInput) => {
    const u = promoteToOutreach(recordId, input);
    if (u) {
      setRecords(loadUnknownResolverQueue());
    }
  }, []);

  return (
    <div className="min-h-0 flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Markets · Internal</p>
          <h1 className="text-xl font-semibold text-neutral-900">Unknown Resolver Review Queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Review unresolved local opportunities and classify them as yes / review / no. Summary stat cards use the full queue (not the active filter). Scores are persisted after first load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/markets/outreach-queue"
            className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
          >
            Outreach queue →
          </Link>
          <Link
            href="/admin/markets"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            ← Back to Markets
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total unknown", value: stats.total },
          { label: "Yes recommended", value: stats.yesRec },
          { label: "Review recommended", value: stats.reviewRec },
          { label: "No recommended", value: stats.noRec },
          { label: "Operator confirmed", value: stats.operatorConfirmed },
          { label: "Remaining unreviewed", value: stats.remainingUnreviewed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{s.label}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-neutral-900">{s.value}</div>
          </div>
        ))}
      </div>

      <UnknownResolverFilters filters={filters} setFilters={setFilters} cityOptions={cityOptions} ringOptions={ringOptions} />

      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Queue</h2>
        <p className="text-xs text-neutral-500">Collapsed by default. Undecided & higher scores sort first.</p>
        <div className="mt-2">
          <UnknownResolverQueue rows={filteredSorted} onUpdateDecision={onUpdateDecision} onPromoteToOutreach={onPromoteToOutreach} />
        </div>
      </section>
    </div>
  );
}
