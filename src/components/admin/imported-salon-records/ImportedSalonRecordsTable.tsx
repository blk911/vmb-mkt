"use client";

import { DecisionStatusBadge } from "@/components/admin/import-diff/DecisionStatusBadge";
import { SalonRecordStatusBadge } from "@/components/admin/imported-salon-records/SalonRecordStatusBadge";
import type { ImportedSalonRecord, ImportedSalonRecordStatus } from "@/lib/imported-salon-records/types";

type ImportedSalonRecordsTableProps = {
  records: ImportedSalonRecord[];
  selectedRecordId?: string;
  busyKey?: string | null;
  onSelect: (recordId: string) => void;
  onUpdateStatus: (recordId: string, status: ImportedSalonRecordStatus) => void;
};

function formatDate(value: string): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ImportedSalonRecordsTable({
  records,
  selectedRecordId,
  busyKey,
  onSelect,
  onUpdateStatus,
}: ImportedSalonRecordsTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-neutral-900">Promoted Salon Records</h2>
        <p className="text-sm text-neutral-600">Review canonical salon records created from approved imported drafts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Business Name</th>
              <th className="px-4 py-3 font-medium">Source Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Decision</th>
              <th className="px-4 py-3 font-medium">Services</th>
              <th className="px-4 py-3 font-medium">Providers</th>
              <th className="px-4 py-3 font-medium">Images</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Source Draft</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((record) => {
                const isSelected = record.id === selectedRecordId;
                return (
                  <tr key={record.id} className={isSelected ? "bg-neutral-50" : "bg-white"}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-neutral-900">{record.businessName}</div>
                      <div className="mt-1 text-xs text-neutral-500">{record.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.sourceType}</td>
                    <td className="px-4 py-3 align-top">
                      <SalonRecordStatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <DecisionStatusBadge status={record.decisionStatus} />
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.services.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.providers.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.portfolioImages.length}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.parseConfidence}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{formatDate(record.createdAt)}</td>
                    <td className="px-4 py-3 align-top text-neutral-700">{record.sourceDraftId}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onSelect(record.id)}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(record.id, "archived")}
                          disabled={record.status === "archived" || busyKey === `${record.id}:archived`}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-60"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-neutral-500">
                  No promoted salon records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
