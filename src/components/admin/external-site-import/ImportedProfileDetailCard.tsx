"use client";

import { useEffect, useMemo, useState } from "react";
import { CanonicalReviewEditor } from "@/components/admin/external-site-import/CanonicalReviewEditor";
import { DraftStatusBadge } from "@/components/admin/external-site-import/DraftStatusBadge";
import { SaveReviewButton } from "@/components/admin/external-site-import/SaveReviewButton";
import { SourceVsReviewComparison } from "@/components/admin/external-site-import/SourceVsReviewComparison";
import { DecisionStatusBadge } from "@/components/admin/import-diff/DecisionStatusBadge";
import { DiffSummaryCard } from "@/components/admin/import-diff/DiffSummaryCard";
import { MergeTargetSuggestionsCard } from "@/components/admin/import-diff/MergeTargetSuggestionsCard";
import { SetDecisionStatusButtons } from "@/components/admin/import-diff/SetDecisionStatusButtons";
import { PromoteDraftButton } from "@/components/admin/imported-salon-records/PromoteDraftButton";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";
import type { DiffSummary, MergeTargetSuggestion } from "@/lib/import-diff/types";
import type { ImportedProfileReviewPayload } from "@/lib/external-site-review/types";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";

type ImportedProfileDetailCardProps = {
  draft: ImportedProfileDraft | null;
  onPromoted?: (record: ImportedSalonRecord) => void;
  onDraftUpdated?: (draft: ImportedProfileDraft) => void;
};

export function ImportedProfileDetailCard({ draft, onPromoted, onDraftUpdated }: ImportedProfileDetailCardProps) {
  const [localReview, setLocalReview] = useState<ImportedProfileReviewPayload | null>(() => draft?.review.payload ?? null);
  const [suggestions, setSuggestions] = useState<MergeTargetSuggestion[]>([]);
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (!draft || !localReview) return false;
    return JSON.stringify(localReview) !== JSON.stringify(draft.review.payload);
  }, [draft, localReview]);

  useEffect(() => {
    if (!draft) {
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
        const response = await fetch(`/api/import-diff/draft/${encodeURIComponent(draft.id)}`, { cache: "no-store" });
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
  }, [draft]);

  if (!draft || !localReview) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm text-neutral-500 shadow-sm">
        Select a draft to inspect canonical review details.
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">{draft.businessName}</h2>
            <p className="mt-1 text-sm text-neutral-500">Review before promotion</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftStatusBadge status={draft.status} />
            <DecisionStatusBadge status={draft.decisionStatus} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Draft</div>
            <div className="mt-2 text-sm font-medium text-neutral-900">{draft.id}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Parse Confidence</div>
            <div className="mt-2 text-sm font-medium text-neutral-900">{draft.parseConfidence}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source Type</div>
            <div className="mt-2 text-sm font-medium text-neutral-900">{draft.sourceType}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reviewed Payload</div>
            <div className="mt-2 text-sm font-medium text-neutral-900">{draft.review.hasEdits ? "edited" : "not edited"}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source URL</div>
            <a href={draft.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-neutral-900 underline">
              {draft.sourceUrl}
            </a>
          </div>
          {draft.review.lastEditedAt ? (
            <div className="text-xs text-neutral-500">Last review edit: {new Date(draft.review.lastEditedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </section>

      <SourceVsReviewComparison draft={draft} />

      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 shadow-sm">
        <CanonicalReviewEditor value={localReview} onChange={setLocalReview} />
        <div className="mt-5 flex flex-wrap items-start gap-4">
          <SaveReviewButton
            draftId={draft.id}
            review={localReview}
            disabled={!hasUnsavedChanges}
            onSaved={(savedDraft) => {
              setLocalReview(savedDraft.review.payload);
              onDraftUpdated?.(savedDraft);
            }}
          />
          {hasUnsavedChanges ? (
            <div className="text-sm text-amber-700">Unsaved local changes. Save review before relying on promotion from this pane.</div>
          ) : (
            <div className="text-sm text-neutral-500">Review payload is in sync with the saved draft.</div>
          )}
        </div>
      </section>

      <section className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Merge / Duplicate Review</h2>
          <p className="text-sm text-neutral-600">Advisory match suggestions against the best available admin entity corpus.</p>
        </div>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <DecisionStatusBadge status={draft.decisionStatus} />
            {draft.decisionUpdatedAt ? (
              <span className="text-xs text-neutral-500">Updated {new Date(draft.decisionUpdatedAt).toLocaleString()}</span>
            ) : null}
          </div>
          <SetDecisionStatusButtons
            endpoint={`/api/external-site-import/${encodeURIComponent(draft.id)}`}
            currentStatus={draft.decisionStatus}
            onUpdated={(entity) => onDraftUpdated?.(entity as ImportedProfileDraft)}
          />
        </section>
        {diffLoading ? <div className="text-sm text-neutral-500">Loading merge suggestions...</div> : null}
        {diffError ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{diffError}</div> : null}
        <MergeTargetSuggestionsCard suggestions={suggestions} />
        <DiffSummaryCard diffSummary={diffSummary} />
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Diagnostics</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft.diagnostics.length ? (
            draft.diagnostics.map((entry) => (
              <span key={entry} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                {entry}
              </span>
            ))
          ) : (
            <span className="text-sm text-neutral-500">No diagnostics recorded.</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Promotion Actions</h2>
          <p className="text-sm text-neutral-600">Promotion uses the latest saved canonical review payload.</p>
        </div>
        {draft.status === "ready" ? (
          <div className="grid gap-2">
            <PromoteDraftButton draftId={draft.id} disabled={hasUnsavedChanges} onPromoted={onPromoted} />
            {hasUnsavedChanges ? (
              <div className="text-sm text-amber-700">Save review changes first so promotion uses the latest canonical fields.</div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">Mark this draft as `ready` before promotion.</div>
        )}
      </section>
    </div>
  );
}
