"use client";

import type { ParsedCandidateRow, ReviewAction } from "@/lib/source-intake/types";

type MatchReviewTableProps = {
  rows: ParsedCandidateRow[];
  busy?: boolean;
  onReviewActionChange: (candidateId: string, reviewAction: ReviewAction) => void;
};

export function MatchReviewTable({ rows, busy, onReviewActionChange }: MatchReviewTableProps) {
  const ambiguousRows = rows.filter((row) => {
    const disposition = row.suggestedMatch?.disposition;
    return disposition === "possible_match" || disposition === "held";
  });

  if (!ambiguousRows.length) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900">Ambiguous Matches</h3>
        <p className="text-sm text-neutral-700">These rows landed in possible-match or held territory and usually need a manual action before processing.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-amber-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-3">Candidate Name</th>
              <th className="px-3 py-3">Top Suggested Operator</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Reasons</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {ambiguousRows.map((row) => (
              <tr key={row.id} className="border-b border-amber-100">
                <td className="px-3 py-3 align-top font-medium text-neutral-900">{row.displayName}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{row.suggestedMatch?.matchedOperatorName || "n/a"}</td>
                <td className="px-3 py-3 align-top text-neutral-700">{row.suggestedMatch?.score ?? 0}</td>
                <td className="px-3 py-3 align-top text-xs text-neutral-600">{(row.suggestedMatch?.reasons || []).join(" | ") || "n/a"}</td>
                <td className="px-3 py-3 align-top">
                  <select
                    value={row.reviewAction ?? "pending"}
                    disabled={busy}
                    onChange={(event) => onReviewActionChange(row.id, event.target.value as ReviewAction)}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-60"
                  >
                    <option value="accept_match">Accept Match</option>
                    <option value="force_new">Force New</option>
                    <option value="hold">Hold</option>
                    <option value="pending">Pending</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
