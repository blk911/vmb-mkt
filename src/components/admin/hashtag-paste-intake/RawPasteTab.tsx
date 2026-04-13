import type { HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export function RawPasteTab({ result }: { result: HashtagPasteIntakeResult | null }) {
  if (!result) return <p className="text-sm text-neutral-500">No paste captured yet.</p>;

  return (
    <pre className="max-h-[760px] overflow-auto rounded-2xl bg-neutral-950 p-4 text-xs text-neutral-100 whitespace-pre-wrap">
      {result.request.rawText}
    </pre>
  );
}
