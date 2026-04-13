import type { HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export function TaggedHandlesTab({ result }: { result: HashtagPasteIntakeResult | null }) {
  if (!result) return <p className="text-sm text-neutral-500">No tagged handles yet.</p>;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th className="px-4 py-3 font-medium">Handle</th>
            <th className="px-4 py-3 font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {result.taggedHandles.length ? (
            result.taggedHandles.map((row) => (
              <tr key={row.handle} className="border-t border-neutral-200">
                <td className="px-4 py-3 text-neutral-900">@{row.handle}</td>
                <td className="px-4 py-3 text-neutral-700">{row.count}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                No tagged handles found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
