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

export async function harvestInstagramHashtag(
  rawHashtag: string,
  limit = 50
): Promise<IGHashtagPost[]> {
  const hashtag = normalizeHashtag(rawHashtag);
  const token = requireEnv("APIFY_TOKEN", process.env.APIFY_TOKEN);

  // Force runtime loading in the server route so Vercel traces these packages
  // as direct runtime dependencies of the harvest path.
  await import("proxy-agent");
  const { ApifyClient } = await import("apify-client");

  const client = new ApifyClient({ token });

  const run = await client.actor("apify/instagram-hashtag-scraper").call({
    hashtags: [hashtag],
    resultsLimit: limit,
  });

  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    throw new Error("Instagram hashtag scraper returned no dataset id");
  }

  const { items } = await client.dataset(datasetId).listItems();

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
