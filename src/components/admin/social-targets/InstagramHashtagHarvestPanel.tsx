"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type HarvestPost = {
  postId: string;
  postUrl: string;
  username: string;
  profileUrl: string;
  caption: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  timestamp: string;
  weeksAgo: number;
};

type HarvestResult = {
  hashtag: string;
  requestedLimit: number;
  postsPulled: number;
  evidenceAdded: number;
  operatorsCreated?: number;
  operatorsMerged?: number;
  summaryPath: string;
  sample?: HarvestPost;
  posts?: HarvestPost[];
};

type ApiResponse =
  | {
      ok: true;
      result: HarvestResult;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeHashtagInput(value: string): string {
  return value.trim().replace(/^#/, "");
}

export default function InstagramHashtagHarvestPanel() {
  const router = useRouter();
  const [hashtag, setHashtag] = useState("denvernails");
  const [limit, setLimit] = useState("50");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HarvestResult | null>(null);

  const cleanedHashtag = useMemo(
    () => normalizeHashtagInput(hashtag),
    [hashtag]
  );

  async function runHarvest() {
    setError(null);
    setResult(null);
    setIsRunning(true);

    try {
      const parsedLimit = Number(limit);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(200, parsedLimit))
        : 50;

      const res = await fetch("/api/social-targets/ig-hashtag-harvest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hashtag: cleanedHashtag,
          limit: safeLimit,
        }),
      });

      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) {
        const message = "error" in data ? data.error : "Harvest failed";
        throw new Error(message);
      }

      setResult(data.result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Instagram Hashtag Harvest
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Run live Instagram hashtag discovery and push new post evidence into
          the resolver pipeline.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.5fr_160px_auto]">
        <div>
          <label
            htmlFor="ig-hashtag"
            className="mb-1 block text-sm font-medium text-neutral-700"
          >
            Hashtag
          </label>
          <input
            id="ig-hashtag"
            type="text"
            value={hashtag}
            onChange={(e) => setHashtag(e.target.value)}
            placeholder="denvernails"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-neutral-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Enter hashtag only. No URL. Example:{" "}
            <span className="font-medium">denvernails</span>
          </p>
        </div>

        <div>
          <label
            htmlFor="ig-limit"
            className="mb-1 block text-sm font-medium text-neutral-700"
          >
            Limit
          </label>
          <input
            id="ig-limit"
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-neutral-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Allowed: 1-200
          </p>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={runHarvest}
            disabled={isRunning || !cleanedHashtag}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Harvest"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Hashtag" value={`#${result.hashtag}`} />
            <StatCard
              label="Requested Limit"
              value={String(result.requestedLimit)}
            />
            <StatCard
              label="Posts Pulled"
              value={String(result.postsPulled)}
            />
            <StatCard
              label="Evidence Added"
              value={String(result.evidenceAdded)}
            />
            <StatCard
              label="Operators Created"
              value={String(result.operatorsCreated ?? 0)}
            />
            <StatCard
              label="Operators Merged"
              value={String(result.operatorsMerged ?? 0)}
            />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-medium text-neutral-800">
              Runtime summary
            </div>
            <div className="mt-1 break-all text-sm text-neutral-600">
              {result.summaryPath}
            </div>
          </div>

          {result.sample ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 text-sm font-medium text-neutral-800">
                Sample post
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Username" value={`@${result.sample.username}`} />
                <Field
                  label="Weeks Ago"
                  value={String(result.sample.weeksAgo)}
                />
                <Field
                  label="Likes"
                  value={String(result.sample.likeCount)}
                />
                <Field
                  label="Comments"
                  value={String(result.sample.commentCount)}
                />
                <Field
                  label="Timestamp"
                  value={result.sample.timestamp || "-"}
                />
                <Field
                  label="Profile URL"
                  value={result.sample.profileUrl || "-"}
                />
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Post URL
                </div>
                <div className="break-all text-sm text-neutral-700">
                  {result.sample.postUrl || "-"}
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Caption
                </div>
                <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                  {result.sample.caption || "-"}
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Hashtags
                </div>
                <div className="flex flex-wrap gap-2">
                  {(result.sample.hashtags ?? []).length > 0 ? (
                    result.sample.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                      >
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500">-</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {(result.posts ?? []).length > 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-800">
                  Current run posts
                </div>
                <div className="text-xs text-neutral-500">
                  {(result.posts ?? []).length} pulled
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        #
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Username
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Weeks
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Likes
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Comments
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Timestamp
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Caption
                      </th>
                      <th className="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-600">
                        Hashtags
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.posts ?? []).map((post, index) => (
                      <tr key={`${post.postId}-${index}`} className="align-top">
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-500">
                          {index + 1}
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3">
                          <div className="font-medium text-neutral-900">
                            @{post.username || "unknown"}
                          </div>
                          <div className="mt-1 break-all text-xs">
                            {post.profileUrl ? (
                              <a
                                href={post.profileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-500 underline underline-offset-2"
                              >
                                profile
                              </a>
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </div>
                          <div className="mt-1 break-all text-xs">
                            {post.postUrl ? (
                              <a
                                href={post.postUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-500 underline underline-offset-2"
                              >
                                post
                              </a>
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                          {post.weeksAgo}
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                          {post.likeCount}
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                          {post.commentCount}
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                          <div className="max-w-[180px] break-words">
                            {post.timestamp || "-"}
                          </div>
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                          <div className="max-w-[320px] whitespace-pre-wrap break-words">
                            {post.caption || "-"}
                          </div>
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3">
                          <div className="flex max-w-[260px] flex-wrap gap-1.5">
                            {(post.hashtags ?? []).length > 0 ? (
                              post.hashtags.map((tag) => (
                                <span
                                  key={`${post.postId}-${tag}`}
                                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                                >
                                  #{tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">
        {value}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 break-all text-sm text-neutral-800">{value}</div>
    </div>
  );
}
