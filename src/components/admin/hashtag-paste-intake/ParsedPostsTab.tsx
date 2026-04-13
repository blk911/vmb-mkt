import type { HashtagPasteIntakeResult } from "@/lib/hashtag-paste-intake/types";

export function ParsedPostsTab({ result }: { result: HashtagPasteIntakeResult | null }) {
  if (!result) return <p className="text-sm text-neutral-500">No parsed posts yet.</p>;

  return (
    <div className="grid gap-4">
      {result.parsedPosts.length ? (
        result.parsedPosts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-neutral-900">{post.handle ? `@${post.handle}` : "No main handle"}</div>
                {post.displayName ? <div className="text-sm text-neutral-600">{post.displayName}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{post.inferredType}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{post.confidence}</span>
                {post.inferredServiceHint ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{post.inferredServiceHint}</span> : null}
                {post.inferredGeoHint ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{post.inferredGeoHint}</span> : null}
              </div>
            </div>
            {post.caption ? <p className="mt-3 text-sm text-neutral-700">{post.caption}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
              {post.hashtags.map((hashtag) => <span key={hashtag} className="rounded-full bg-white px-2.5 py-1">{hashtag}</span>)}
              {post.taggedHandles.map((handle) => <span key={handle} className="rounded-full bg-white px-2.5 py-1">@{handle}</span>)}
            </div>
            {post.reasons.length ? (
              <div className="mt-3 text-xs text-neutral-500">
                Reasons: {post.reasons.join(" · ")}
              </div>
            ) : null}
            <details className="mt-3 text-xs text-neutral-500">
              <summary className="cursor-pointer font-medium">Raw Block</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3">{post.rawBlock}</pre>
            </details>
          </article>
        ))
      ) : (
        <p className="text-sm text-neutral-500">No parsed posts found.</p>
      )}
    </div>
  );
}
