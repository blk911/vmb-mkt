"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchReviewTable } from "@/components/admin/source-intake/MatchReviewTable";
import { ParsePreviewTable } from "@/components/admin/source-intake/ParsePreviewTable";
import { SourceIntakeForm } from "@/components/admin/source-intake/SourceIntakeForm";
import { SourceIntakeTable } from "@/components/admin/source-intake/SourceIntakeTable";
import type {
  IntakeProcessingReceipt,
  ParsedCandidateRow,
  ReviewAction,
  SourceIntakeRecord,
} from "@/lib/source-intake/types";

type IntakeListResponse = {
  ok: boolean;
  error?: string;
  intakes?: SourceIntakeRecord[];
};

type IntakeDetailResponse = {
  ok: boolean;
  error?: string;
  intake?: SourceIntakeRecord;
  parsedCandidates?: ParsedCandidateRow[];
  processingReceipts?: IntakeProcessingReceipt[];
};

type ParseResponse = {
  ok: boolean;
  error?: string;
  intake?: SourceIntakeRecord;
  parsedCandidates?: ParsedCandidateRow[];
};

type ProcessResponse = {
  ok: boolean;
  error?: string;
  receipt?: IntakeProcessingReceipt;
};

export default function SourceIntakeAdminPage() {
  const [intakes, setIntakes] = useState<SourceIntakeRecord[]>([]);
  const [selectedIntake, setSelectedIntake] = useState<SourceIntakeRecord | null>(null);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedCandidateRow[]>([]);
  const [processingReceipts, setProcessingReceipts] = useState<IntakeProcessingReceipt[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadIntakes = useCallback(async (selectId?: string) => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/source-intake", { cache: "no-store" });
      const json = (await response.json()) as IntakeListResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load intakes");
      const nextIntakes = json.intakes ?? [];
      setIntakes(nextIntakes);
      setSelectedIntake((current) => {
        const targetId = selectId || current?.id;
        if (!targetId) return current;
        return nextIntakes.find((row) => row.id === targetId) || null;
      });
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load source intakes");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadIntakeDetail = useCallback(async (intakeId: string) => {
    setBusyKey((current) => current ?? `view:${intakeId}`);
    try {
      const response = await fetch(`/api/source-intake/${encodeURIComponent(intakeId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as IntakeDetailResponse;
      if (!response.ok || !json.ok || !json.intake) {
        throw new Error(json.error || "Failed to load intake detail");
      }
      setSelectedIntake(json.intake);
      setParsedCandidates(json.parsedCandidates ?? []);
      setProcessingReceipts(json.processingReceipts ?? []);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load intake detail");
    } finally {
      setBusyKey((current) => (current?.startsWith("view:") ? null : current));
    }
  }, []);

  useEffect(() => {
    void loadIntakes();
  }, [loadIntakes]);

  const handleParse = useCallback(async (intakeId: string) => {
    setBusyKey(`parse:${intakeId}`);
    try {
      const response = await fetch(`/api/source-intake/${encodeURIComponent(intakeId)}/parse`, {
        method: "POST",
      });
      const json = (await response.json()) as ParseResponse;
      if (!response.ok || !json.ok || !json.intake) {
        throw new Error(json.error || "Failed to parse intake");
      }
      await loadIntakes(intakeId);
      setSelectedIntake(json.intake);
      setParsedCandidates(json.parsedCandidates ?? []);
      setProcessingReceipts([]);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to parse intake");
    } finally {
      setBusyKey(null);
    }
  }, [loadIntakes]);

  const handleProcess = useCallback(async (intakeId: string) => {
    setBusyKey(`process:${intakeId}`);
    try {
      const reviewActions =
        selectedIntake?.id === intakeId
          ? parsedCandidates.map((row) => ({
              candidateId: row.id,
              reviewAction: (row.reviewAction ?? "pending") as ReviewAction,
            }))
          : undefined;

      const response = await fetch(`/api/source-intake/${encodeURIComponent(intakeId)}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewActions ? { reviewActions } : {}),
      });
      const json = (await response.json()) as ProcessResponse;
      if (!response.ok || !json.ok || !json.receipt) {
        throw new Error(json.error || "Failed to process intake");
      }
      await loadIntakes(intakeId);
      await loadIntakeDetail(intakeId);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to process intake");
    } finally {
      setBusyKey(null);
    }
  }, [loadIntakeDetail, loadIntakes, parsedCandidates, selectedIntake?.id]);

  const handleReviewActionChange = useCallback((candidateId: string, reviewAction: ReviewAction) => {
    setParsedCandidates((rows) =>
      rows.map((row) => (row.id === candidateId ? { ...row, reviewAction } : row))
    );
  }, []);

  const sourceIntelligence = useMemo(() => {
    const counts = {
      totalParsed: parsedCandidates.length,
      matched: 0,
      possible: 0,
      newCandidate: 0,
      held: 0,
    };
    for (const row of parsedCandidates) {
      const disposition = row.suggestedMatch?.disposition;
      if (disposition === "matched") counts.matched += 1;
      else if (disposition === "possible_match") counts.possible += 1;
      else if (disposition === "new_candidate") counts.newCandidate += 1;
      else if (disposition === "held") counts.held += 1;
    }
    return counts;
  }, [parsedCandidates]);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Source Intake Admin</h1>
          <p className="mt-1 text-sm text-neutral-600">Create, parse, review, and process operator source text without mutating canonical operator records directly.</p>
        </div>

        {pageError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div> : null}

        <SourceIntakeForm
          onSuccess={({ intake, parsedCandidates: nextParsedCandidates }) => {
            setSelectedIntake(intake);
            setParsedCandidates(nextParsedCandidates ?? []);
            setProcessingReceipts([]);
            void loadIntakes(intake.id);
          }}
        />

        <SourceIntakeTable
          intakes={intakes}
          selectedIntakeId={selectedIntake?.id}
          busyKey={busyKey}
          onView={(intakeId) => void loadIntakeDetail(intakeId)}
          onParse={(intakeId) => void handleParse(intakeId)}
          onProcess={(intakeId) => void handleProcess(intakeId)}
        />

        {selectedIntake ? (
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">{selectedIntake.sourceLabel}</h2>
                    <p className="text-sm text-neutral-600">{selectedIntake.sourceType}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleParse(selectedIntake.id)}
                      disabled={busyKey === `parse:${selectedIntake.id}`}
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
                    >
                      {busyKey === `parse:${selectedIntake.id}` ? "Parsing..." : "Parse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleProcess(selectedIntake.id)}
                      disabled={busyKey === `process:${selectedIntake.id}`}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyKey === `process:${selectedIntake.id}` ? "Processing..." : "Process"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
                  <div><span className="font-medium text-neutral-900">Status:</span> {selectedIntake.status}</div>
                  <div><span className="font-medium text-neutral-900">Submitted:</span> {new Date(selectedIntake.submittedAt).toLocaleString()}</div>
                  <div><span className="font-medium text-neutral-900">Facility:</span> {selectedIntake.facilityName || selectedIntake.facilityId || "n/a"}</div>
                  <div><span className="font-medium text-neutral-900">Location:</span> {[selectedIntake.city, selectedIntake.state].filter(Boolean).join(", ") || "n/a"}</div>
                  <div className="md:col-span-2"><span className="font-medium text-neutral-900">Source URL:</span> {selectedIntake.sourceUrl || "n/a"}</div>
                  <div className="md:col-span-2"><span className="font-medium text-neutral-900">Notes:</span> {selectedIntake.notes || "n/a"}</div>
                </div>

                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Raw Intake</h3>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-neutral-950 p-4 text-xs leading-6 text-neutral-100">
                    {selectedIntake.rawText}
                  </pre>
                </div>
              </section>

              <ParsePreviewTable
                rows={parsedCandidates}
                busy={busyKey === `process:${selectedIntake.id}`}
                onReviewActionChange={handleReviewActionChange}
              />

              <MatchReviewTable
                rows={parsedCandidates}
                busy={busyKey === `process:${selectedIntake.id}`}
                onReviewActionChange={handleReviewActionChange}
              />
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Source Intelligence</h2>
                  <p className="text-sm text-neutral-600">Quick readout of the current parsed intake.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Total Parsed", String(sourceIntelligence.totalParsed)],
                    ["Matched", String(sourceIntelligence.matched)],
                    ["Possible Matches", String(sourceIntelligence.possible)],
                    ["New Candidates", String(sourceIntelligence.newCandidate)],
                    ["Held", String(sourceIntelligence.held)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-neutral-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
                      <div className="mt-1 text-lg font-semibold text-neutral-900">{value}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Processing Receipts</h2>
                  <p className="text-sm text-neutral-600">Latest receipts for this intake. Processing is idempotent and reuses the saved receipt once completed.</p>
                </div>

                {processingReceipts.length ? (
                  <div className="space-y-4">
                    {processingReceipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-xl border border-neutral-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-medium text-neutral-900">{new Date(receipt.processedAt).toLocaleString()}</div>
                          <div className="text-xs text-neutral-500">{receipt.id}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-neutral-700">
                          <div>Evidence Created: {receipt.evidenceCreated}</div>
                          <div>Matched: {receipt.matchedCount}</div>
                          <div>New Candidates: {receipt.newCandidateCount}</div>
                          <div>Held: {receipt.heldCount}</div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                          {receipt.candidateResults.map((result) => (
                            <div key={result.candidateId} className="rounded-lg bg-neutral-50 px-3 py-2">
                              <div className="font-medium text-neutral-900">{result.displayName}</div>
                              <div className="text-neutral-600">
                                {result.action}
                                {result.operatorId ? ` -> ${result.operatorId}` : ""}
                                {result.createdCandidateId ? ` -> ${result.createdCandidateId}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No processing receipt yet.</p>
                )}
              </section>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            {loadingList ? "Loading source intakes..." : "Select an intake to review parse results and receipts."}
          </section>
        )}
      </div>
    </main>
  );
}
