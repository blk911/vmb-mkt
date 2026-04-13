import type { HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export function PasteSummaryCard({ result }: { result: HashtagPasteIntakeResult | null }) {
  const rows = [
    { label: "Hashtag", value: result?.request.hashtag || "-" },
    { label: "Geo Hint", value: result?.request.geoHint || "-" },
    { label: "Service Hint", value: result?.request.serviceHint || "-" },
    { label: "Parsed Posts", value: String(result?.parsedPosts.length || 0) },
    { label: "Provider Candidates", value: String(result?.providerCandidates.length || 0) },
    { label: "Tagged Handles", value: String(result?.taggedHandles.length || 0) },
    { label: "Client Signals", value: String(result?.clientSignalPosts.length || 0) },
    { label: "Diagnostics", value: String(result?.diagnostics.length || 0) },
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-neutral-900">Summary</h2>
        <p className="text-sm text-neutral-600">Quick counts for the current paste intake run.</p>
      </div>
      <div className="grid gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{row.label}</div>
            <div className="text-neutral-800">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
