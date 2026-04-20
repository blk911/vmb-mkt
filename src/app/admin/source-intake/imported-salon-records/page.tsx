"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImportedSalonRecordDetailCard } from "@/components/admin/imported-salon-records/ImportedSalonRecordDetailCard";
import { ImportedSalonRecordsTable } from "@/components/admin/imported-salon-records/ImportedSalonRecordsTable";
import type { ImportedSalonRecord, ImportedSalonRecordStatus } from "@/lib/imported-salon-records/types";

type ImportedSalonRecordsResponse = {
  ok: boolean;
  error?: string;
  records?: ImportedSalonRecord[];
  record?: ImportedSalonRecord;
};

export default function Page() {
  const [records, setRecords] = useState<ImportedSalonRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRecords = useCallback(async (selectRecordId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/imported-salon-records", { cache: "no-store" });
      const json = (await response.json()) as ImportedSalonRecordsResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load imported salon records");
      const nextRecords = json.records ?? [];
      setRecords(nextRecords);
      setSelectedRecordId((current) => {
        const targetId = selectRecordId || current || nextRecords[0]?.id || null;
        return nextRecords.some((record) => record.id === targetId) ? targetId : nextRecords[0]?.id || null;
      });
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load imported salon records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId]
  );

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc[record.status] += 1;
        return acc;
      },
      { active: 0, archived: 0 } as Record<ImportedSalonRecordStatus, number>
    );
  }, [records]);

  async function handleUpdateStatus(recordId: string, status: ImportedSalonRecordStatus) {
    setBusyKey(`${recordId}:${status}`);
    setPageError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/imported-salon-records/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as ImportedSalonRecordsResponse;
      if (!response.ok || !json.ok || !json.record) {
        throw new Error(json.error || "Failed to update record status");
      }
      setRecords((current) => current.map((record) => (record.id === json.record?.id ? json.record : record)));
      setSelectedRecordId(json.record.id);
      setStatusMessage(`Salon record ${json.record.id} marked ${status}.`);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to update record status");
    } finally {
      setBusyKey(null);
    }
  }

  function handleRecordUpdated(updatedRecord: ImportedSalonRecord) {
    setRecords((current) => current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record)));
    setSelectedRecordId(updatedRecord.id);
    setStatusMessage(`Salon record ${updatedRecord.id} updated.`);
    setPageError(null);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Imported Salon Records</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Canonical admin salon records promoted from approved imported drafts.
          </p>
        </div>

        {pageError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div> : null}
        {statusMessage ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusMessage}</div>
        ) : null}

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Summary</h2>
            <p className="text-sm text-neutral-600">Track active versus archived canonical salon records.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-950">{counts.active}</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Archived</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-950">{counts.archived}</div>
            </div>
          </div>
        </section>

        {loading ? <div className="text-sm text-neutral-500">Loading promoted salon records...</div> : null}

        <ImportedSalonRecordsTable
          records={records}
          selectedRecordId={selectedRecordId ?? undefined}
          busyKey={busyKey}
          onSelect={setSelectedRecordId}
          onUpdateStatus={(recordId, status) => void handleUpdateStatus(recordId, status)}
        />

        <ImportedSalonRecordDetailCard
          key={selectedRecord ? `${selectedRecord.id}:${selectedRecord.updatedAt}` : "empty-record"}
          record={selectedRecord}
          onRecordUpdated={handleRecordUpdated}
        />
      </div>
    </main>
  );
}
