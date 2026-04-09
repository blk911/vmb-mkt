"use client";

import type { ParsedCandidateRow, ReviewAction } from "@/lib/source-intake/types";

type ParsePreviewTableProps = {
  rows: ParsedCandidateRow[];
  busy?: boolean;
  onReviewActionChange: (candidateId: string, reviewAction: ReviewAction) => void;
};

function scoreTone(score?: number): string {
  if ((score || 0) >= 90) return "text-emerald-700";
  if ((score || 0) >= 70) return "text-amber-700";
  return "text-neutral-600";
}

export function ParsePreviewTable({ rows, busy, onReviewActionChange }: ParsePreviewTableProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Parse Preview</h3>
          <p className="text-sm text-neutral-600">Review parser output, suggested matches, and per-row actions before processing.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Ordinal</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Parse Confidence</th>
              <th className="px-3 py-3">Suggested Match</th>
              <th className="px-3 py-3">Match Score</th>
              <th className="px-3 py-3">Match Reasons</th>
              <th className="px-3 py-3">Review Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="px-3 py-3 align-top text-neutral-700">{row.ordinal}</td>
                <td className="px-3 py-3 align-top">
                  <div className="font-medium text-neutral-900">{row.displayName}</div>
                  {row.parseWarnings?.length ? <div className="mt-1 text-xs text-neutral-500">{row.parseWarnings.join(", ")}</div> : null}
                </td>
                <td className="px-3 py-3 align-top text-neutral-700">{row.roleLabel || "n/a"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{row.priceText || "n/a"}</td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{row.parseConfidence}</span>
                </td>
                <td className="px-3 py-3 align-top text-neutral-700">
                  {row.suggestedMatch?.matchedOperatorName || row.suggestedMatch?.disposition || "n/a"}
                </td>
                <td className={`px-3 py-3 align-top font-semibold ${scoreTone(row.suggestedMatch?.score)}`}>
                  {row.suggestedMatch?.score ?? 0}
                </td>
                <td className="px-3 py-3 align-top text-xs text-neutral-600">
                  {(row.suggestedMatch?.reasons || []).length ? (row.suggestedMatch?.reasons || []).join(" | ") : "n/a"}
                </td>
                <td className="px-3 py-3 align-top">
                  <select
                    value={row.reviewAction ?? "pending"}
                    disabled={busy}
                    onChange={(event) => onReviewActionChange(row.id, event.target.value as ReviewAction)}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-60"
                  >
                    <option value="accept_match">Accept Match</option>
                    <option value="force_new">Force New</option>
                    <option value="hold">Hold</option>
                    <option value="pending">Pending</option>
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No parsed candidates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
