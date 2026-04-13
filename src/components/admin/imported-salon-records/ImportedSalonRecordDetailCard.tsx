"use client";

import { useEffect, useState } from "react";
import { DecisionStatusBadge } from "@/components/admin/import-diff/DecisionStatusBadge";
import { DiffSummaryCard } from "@/components/admin/import-diff/DiffSummaryCard";
import { MergeTargetSuggestionsCard } from "@/components/admin/import-diff/MergeTargetSuggestionsCard";
import { SetDecisionStatusButtons } from "@/components/admin/import-diff/SetDecisionStatusButtons";
import { SalonRecordStatusBadge } from "@/components/admin/imported-salon-records/SalonRecordStatusBadge";
import type { DiffSummary, MergeTargetSuggestion } from "@/lib/import-diff/types";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";

type ImportedSalonRecordDetailCardProps = {
  record: ImportedSalonRecord | null;
  onRecordUpdated?: (record: ImportedSalonRecord) => void;
};

export function ImportedSalonRecordDetailCard({ record, onRecordUpdated }: ImportedSalonRecordDetailCardProps) {
  const [suggestions, setSuggestions] = useState<MergeTargetSuggestion[]>([]);
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) {
      setSuggestions([]);
      setDiffSummary(null);
      setDiffError(null);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);
    setSuggestions([]);
    setDiffSummary(null);
    void (async () => {
      try {
        const response = await fetch(`/api/import-diff/record/${encodeURIComponent(record.id)}`, { cache: "no-store" });
        const json = (await response.json()) as {
          ok: boolean;
          error?: string;
          suggestions?: MergeTargetSuggestion[];
          diffSummary?: DiffSummary | null;
        };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || "Failed to load merge suggestions");
        }
        if (cancelled) return;
        setSuggestions(json.suggestions ?? []);
        setDiffSummary(json.diffSummary ?? null);
      } catch (error: unknown) {
        if (cancelled) return;
        setDiffError(error instanceof Error ? error.message : "Failed to load merge suggestions");
      } finally {
        if (!cancelled) setDiffLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record]);

  if (!record) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm text-neutral-500 shadow-sm">
        Select a promoted salon record to inspect canonical mapping details.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">{record.businessName}</h2>
          <p className="mt-1 text-sm text-neutral-500">{record.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SalonRecordStatusBadge status={record.status} />
          <DecisionStatusBadge status={record.decisionStatus} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          <section className="grid gap-2 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source Draft ID</div>
              <div className="text-neutral-900">{record.sourceDraftId}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source Type</div>
              <div className="text-neutral-900">{record.sourceType}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Parse Confidence</div>
              <div className="text-neutral-900">{record.parseConfidence}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Decision</div>
              <div className="text-neutral-900">{record.decisionStatus}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source URL</div>
              <a href={record.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-neutral-900 underline">
                {record.sourceUrl}
              </a>
            </div>
            {record.bookingUrl ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking URL</div>
                <a href={record.bookingUrl} target="_blank" rel="noreferrer noopener" className="text-neutral-900 underline">
                  {record.bookingUrl}
                </a>
              </div>
            ) : null}
            {record.instagramUrl ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Instagram URL</div>
                <a href={record.instagramUrl} target="_blank" rel="noreferrer noopener" className="text-neutral-900 underline">
                  {record.instagramUrl}
                </a>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Services</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-950">{record.services.length}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Providers</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-950">{record.providers.length}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Portfolio Images</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-950">{record.portfolioImages.length}</div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Referral Block</div>
              <div className="mt-2 font-medium text-neutral-900">{record.referralBlock.headline}</div>
              <p className="mt-1 text-sm text-neutral-600">{record.referralBlock.body}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Gift Block</div>
              <div className="mt-2 font-medium text-neutral-900">{record.giftBlock.headline}</div>
              <p className="mt-1 text-sm text-neutral-600">{record.giftBlock.body}</p>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Network Block</div>
            <div className="mt-2 font-medium text-neutral-900">{record.networkBlock.headline}</div>
            <p className="mt-1 text-sm text-neutral-600">{record.networkBlock.body}</p>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Diagnostics</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {record.diagnostics.length ? (
                record.diagnostics.map((entry) => (
                  <span key={entry} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                    {entry}
                  </span>
                ))
              ) : (
                <span className="text-sm text-neutral-500">No diagnostics recorded.</span>
              )}
            </div>
          </section>

          <section className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Merge / Duplicate Review</h2>
              <p className="text-sm text-neutral-600">Advisory similarity review against the best available admin entity corpus.</p>
            </div>
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <DecisionStatusBadge status={record.decisionStatus} />
                {record.decisionUpdatedAt ? (
                  <span className="text-xs text-neutral-500">Updated {new Date(record.decisionUpdatedAt).toLocaleString()}</span>
                ) : null}
              </div>
              <SetDecisionStatusButtons
                endpoint={`/api/imported-salon-records/${encodeURIComponent(record.id)}`}
                currentStatus={record.decisionStatus}
                onUpdated={(entity) => onRecordUpdated?.(entity as ImportedSalonRecord)}
              />
            </section>
            {diffLoading ? <div className="text-sm text-neutral-500">Loading merge suggestions...</div> : null}
            {diffError ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{diffError}</div> : null}
            <MergeTargetSuggestionsCard suggestions={suggestions} />
            <DiffSummaryCard diffSummary={diffSummary} />
          </section>
        </div>

        <div>
          {record.heroImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              <div
                className="h-72 w-full bg-cover bg-center"
                style={{ backgroundImage: `url("${record.heroImageUrl}")` }}
              />
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
              No hero image mapped
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
