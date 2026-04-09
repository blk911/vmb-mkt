"use client";

import type { SourceIntakeRecord } from "@/lib/source-intake/types";

type SourceIntakeTableProps = {
  intakes: SourceIntakeRecord[];
  selectedIntakeId?: string;
  busyKey?: string | null;
  onView: (intakeId: string) => void;
  onParse: (intakeId: string) => void;
  onProcess: (intakeId: string) => void;
};

function facilityLabel(intake: SourceIntakeRecord): string {
  return intake.facilityName || intake.facilityId || "Unanchored";
}

function cityStateLabel(intake: SourceIntakeRecord): string {
  return [intake.city, intake.state].filter(Boolean).join(", ") || "n/a";
}

export function SourceIntakeTable({
  intakes,
  selectedIntakeId,
  busyKey,
  onView,
  onParse,
  onProcess,
}: SourceIntakeTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Recent Intakes</h2>
          <p className="text-sm text-neutral-600">Newest first. Select a row to review parsed candidates and processing receipts.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{intakes.length} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Submitted</th>
              <th className="px-3 py-3">Source Label</th>
              <th className="px-3 py-3">Source Type</th>
              <th className="px-3 py-3">Facility</th>
              <th className="px-3 py-3">City/State</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Candidates</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {intakes.map((intake) => {
              const isSelected = intake.id === selectedIntakeId;
              const candidateCount = intake.parseSummary?.totalCandidates ?? 0;
              return (
                <tr
                  key={intake.id}
                  className={isSelected ? "bg-neutral-50" : "border-b border-neutral-100"}
                >
                  <td className="px-3 py-3 align-top text-neutral-700">{new Date(intake.submittedAt).toLocaleString()}</td>
                  <td className="px-3 py-3 align-top font-medium text-neutral-900">{intake.sourceLabel}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{intake.sourceType}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{facilityLabel(intake)}</td>
                  <td className="px-3 py-3 align-top text-neutral-700">{cityStateLabel(intake)}</td>
                  <td className="px-3 py-3 align-top">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{intake.status}</span>
                  </td>
                  <td className="px-3 py-3 align-top text-neutral-700">{candidateCount}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onView(intake.id)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onParse(intake.id)}
                        disabled={busyKey === `parse:${intake.id}`}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-60"
                      >
                        {busyKey === `parse:${intake.id}` ? "Parsing..." : "Parse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onProcess(intake.id)}
                        disabled={busyKey === `process:${intake.id}`}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busyKey === `process:${intake.id}` ? "Processing..." : "Process"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {intakes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No source intakes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
