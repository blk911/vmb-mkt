"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { ImportedProfileDetailCard } from "@/components/admin/external-site-import/ImportedProfileDetailCard";
import { ImportedProfilesTable } from "@/components/admin/external-site-import/ImportedProfilesTable";
import type { ImportedProfileDraft, ImportedProfileDraftStatus } from "@/lib/external-site-import/types";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";

type ImportedProfilesResponse = {
  ok: boolean;
  error?: string;
  drafts?: ImportedProfileDraft[];
  draft?: ImportedProfileDraft;
};

export default function Page() {
  const [drafts, setDrafts] = useState<ImportedProfileDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadDrafts = useCallback(async (selectDraftId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/external-site-import", { cache: "no-store" });
      const json = (await response.json()) as ImportedProfilesResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load imported profiles");
      const nextDrafts = json.drafts ?? [];
      setDrafts(nextDrafts);
      setSelectedDraftId((current) => {
        const targetId = selectDraftId || current || nextDrafts[0]?.id || null;
        return nextDrafts.some((draft) => draft.id === targetId) ? targetId : nextDrafts[0]?.id || null;
      });
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load imported profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  const counts = useMemo(() => {
    return drafts.reduce(
      (acc, draft) => {
        acc[draft.status] += 1;
        return acc;
      },
      { draft: 0, reviewed: 0, ready: 0, rejected: 0 } as Record<ImportedProfileDraftStatus, number>
    );
  }, [drafts]);

  async function handleUpdateStatus(draftId: string, status: ImportedProfileDraftStatus) {
    setBusyKey(`${draftId}:${status}`);
    setPageError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/external-site-import/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as ImportedProfilesResponse;
      if (!response.ok || !json.ok || !json.draft) throw new Error(json.error || "Failed to update draft status");
      setDrafts((current) => current.map((draft) => (draft.id === json.draft?.id ? json.draft : draft)));
      setSelectedDraftId(json.draft.id);
      setStatusMessage(`Draft ${json.draft.id} marked ${status}.`);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to update draft status");
    } finally {
      setBusyKey(null);
    }
  }

  function handlePromoted(record: ImportedSalonRecord) {
    setStatusMessage(`Draft ${record.sourceDraftId} promoted to salon record ${record.id}.`);
    setPageError(null);
  }

  function handleDraftUpdated(updatedDraft: ImportedProfileDraft) {
    setDrafts((current) => current.map((draft) => (draft.id === updatedDraft.id ? updatedDraft : draft)));
    setSelectedDraftId(updatedDraft.id);
    setStatusMessage(`Draft ${updatedDraft.id} updated.`);
    setPageError(null);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Imported Profiles</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Draft VMB profiles created from external site captures and prepared for canonical review.
          </p>
        </div>

        {pageError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div> : null}
        {statusMessage ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusMessage}</div>
        ) : null}

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Summary</h2>
            <p className="text-sm text-neutral-600">Track imported draft status before any canonical merge or publishing.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Draft</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-950">{counts.draft}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Reviewed</div>
              <div className="mt-2 text-2xl font-semibold text-amber-950">{counts.reviewed}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ready</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-950">{counts.ready}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</div>
              <div className="mt-2 text-2xl font-semibold text-rose-950">{counts.rejected}</div>
            </div>
          </div>
        </section>

        {loading ? <div className="text-sm text-neutral-500">Loading imported draft profiles...</div> : null}

        <ImportedProfilesTable
          drafts={drafts}
          selectedDraftId={selectedDraftId ?? undefined}
          busyKey={busyKey}
          onSelect={setSelectedDraftId}
          onUpdateStatus={(draftId, status) => void handleUpdateStatus(draftId, status)}
          onPromoted={handlePromoted}
        />

        <ImportedProfileDetailCard
          key={selectedDraft ? `${selectedDraft.id}:${selectedDraft.updatedAt}` : "empty-draft"}
          draft={selectedDraft}
          onPromoted={handlePromoted}
          onDraftUpdated={handleDraftUpdated}
        />
      </div>
    </main>
  );
}
