import type { IGHashtagPost } from "./types";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getWeeksAgo(timestamp: string): number {
  const postDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - postDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
}

function normalizeHashtag(input: string): string {
  return input.trim().replace(/^#/, "").toLowerCase();
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

async function parseApifyError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return data.error?.message || data.message || `Apify request failed (${response.status})`;
  } catch {
    return `Apify request failed (${response.status})`;
  }
}

export async function harvestInstagramHashtag(
  rawHashtag: string,
  limit = 50
): Promise<IGHashtagPost[]> {
  const hashtag = normalizeHashtag(rawHashtag);
  const token = requireEnv("APIFY_TOKEN", process.env.APIFY_TOKEN);
  const response = await fetch(
    "https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?format=json&clean=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hashtags: [hashtag],
        resultsLimit: limit,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(await parseApifyError(response));
  }

  const items = (await response.json()) as unknown[];

  return (items as unknown[]).map((item) => {
    const post = (item ?? {}) as Record<string, unknown>;
    const username = String(post.ownerUsername ?? "").trim();
    const postUrl = String(post.url ?? "").trim();
    const timestamp = String(post.timestamp ?? "").trim();

    const fallbackPostId =
      postUrl ||
      `${username}:${timestamp}` ||
      `ig-post-${Math.random().toString(36).slice(2)}`;

    return {
      postId: String(post.id ?? fallbackPostId),
      postUrl,
      username,
      profileUrl: username
        ? `https://www.instagram.com/${username}/`
        : "",
      caption: String(post.caption ?? "").trim(),
      hashtags: safeArray(post.hashtags),
      likeCount: Number(post.likesCount ?? 0),
      commentCount: Number(post.commentsCount ?? 0),
      timestamp,
      weeksAgo: timestamp ? getWeeksAgo(timestamp) : 0,
    } satisfies IGHashtagPost;
  });
}
