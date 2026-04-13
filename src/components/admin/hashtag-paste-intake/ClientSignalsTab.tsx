import type { HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export function ClientSignalsTab({ result }: { result: HashtagPasteIntakeResult | null }) {
  if (!result) return <p className="text-sm text-neutral-500">No client-signal posts yet.</p>;

  return (
    <div className="grid gap-4">
      {result.clientSignalPosts.length ? (
        result.clientSignalPosts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{post.confidence}</span>
              {post.handle ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">@{post.handle}</span> : null}
            </div>
            {post.caption ? <p className="mt-3 text-sm text-neutral-700">{post.caption}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
              {post.taggedHandles.map((handle) => <span key={handle} className="rounded-full bg-white px-2.5 py-1">@{handle}</span>)}
            </div>
            {post.reasons.length ? (
              <div className="mt-3 text-xs text-neutral-500">Reasons: {post.reasons.join(" · ")}</div>
            ) : null}
          </article>
        ))
      ) : (
        <p className="text-sm text-neutral-500">No client-signal posts identified.</p>
      )}
    </div>
  );
}
