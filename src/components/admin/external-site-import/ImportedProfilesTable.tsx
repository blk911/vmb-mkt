"use client";

import { DraftStatusBadge } from "@/components/admin/external-site-import/DraftStatusBadge";
import { DecisionStatusBadge } from "@/components/admin/import-diff/DecisionStatusBadge";
import { PromoteDraftButton } from "@/components/admin/imported-salon-records/PromoteDraftButton";
import type { ImportedProfileDraft, ImportedProfileDraftStatus } from "@/lib/external-site-import/types";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";

type ImportedProfilesTableProps = {
  drafts: ImportedProfileDraft[];
  selectedDraftId?: string;
  busyKey?: string | null;
  onSelect: (draftId: string) => void;
  onUpdateStatus: (draftId: string, status: ImportedProfileDraftStatus) => void;
  onPromoted?: (record: ImportedSalonRecord) => void;
};

function formatDate(value: string): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ImportedProfilesTable({
  drafts,
  selectedDraftId,
  busyKey,
  onSelect,
  onUpdateStatus,
  onPromoted,
}: ImportedProfilesTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-neutral-900">Draft Profiles</h2>
        <p className="text-sm text-neutral-600">Review imported profiles created from external site captures.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Business Name</th>
              <th className="px-4 py-3 font-medium">Source Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Decision</th>
              <th className="px-4 py-3 font-medium">Reviewed Payload</th>
              <th className="px-4 py-3 font-medium">Services</th>
              <th className="px-4 py-3 font-medium">Providers</th>
              <th className="px-4 py-3 font-medium">Images</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drafts.length ? (
              drafts.map((draft) => {
                const isSelected = draft.id === selectedDraftId;
                return (
                  <tr key={draft.id} className={isSelected ? "bg-neutral-50" : "bg-white"}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-neutral-900">{draft.businessName}</div>
                      <div className="mt-1 text-xs text-neutral-500">{draft.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-700">{draft.sourceType}</td>
                    <td className="px-4 py-3 align-top">
                      <DraftStatusBadge status={draft.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <DecisionStatusBadge status={draft.decisionStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          draft.review.hasEdits ? "bg-sky-100 text-sky-800" : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {draft.review.hasEdits ? "edited" : "not edited"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-700">{draft.services.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{draft.providers.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{draft.portfolioImages.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{draft.parseConfidence}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{formatDate(draft.createdAt)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onSelect(draft.id)}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(draft.id, "reviewed")}
                          disabled={busyKey === `${draft.id}:reviewed`}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-60"
                        >
                          Mark Reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(draft.id, "ready")}
                          disabled={busyKey === `${draft.id}:ready`}
                          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 disabled:opacity-60"
                        >
                          Mark Ready
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(draft.id, "rejected")}
                          disabled={busyKey === `${draft.id}:rejected`}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-800 disabled:opacity-60"
                        >
                          Reject
                        </button>
                        {draft.status === "ready" ? (
                          <PromoteDraftButton draftId={draft.id} compact onPromoted={onPromoted} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-neutral-500">
                  No imported draft profiles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
