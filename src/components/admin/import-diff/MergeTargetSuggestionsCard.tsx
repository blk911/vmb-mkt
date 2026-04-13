import { SimilarityReasonsList } from "@/components/admin/import-diff/SimilarityReasonsList";
import type { MergeTargetSuggestion } from "@/lib/import-diff/types";

export function MergeTargetSuggestionsCard({ suggestions }: { suggestions: MergeTargetSuggestion[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">Merge Target Suggestions</h2>
        <p className="text-sm text-neutral-600">Top likely existing entities based on deterministic name, domain, and social matching.</p>
      </div>

      {suggestions.length ? (
        <div className="grid gap-4">
          {suggestions.map((suggestion) => (
            <div key={`${suggestion.targetType}:${suggestion.targetId}`} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-neutral-900">{suggestion.businessName}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {suggestion.targetType} · {suggestion.targetId}
                  </div>
                </div>
                <div className="text-sm text-neutral-700">
                  Score {suggestion.score} · {suggestion.confidence}
                </div>
              </div>
              <div className="mt-3">
                <SimilarityReasonsList reasons={suggestion.reasons} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(suggestion.matchedFields)
                  .filter(([, matched]) => Boolean(matched))
                  .map(([field]) => (
                    <span key={field} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                      {field}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-neutral-500">No likely merge targets found.</div>
      )}
    </section>
  );
}
