import type { EvidenceRecord } from "../../evidence/types";
import type { IGHashtagPost } from "./types";

function deriveTitle(post: IGHashtagPost): string {
  if (post.caption) {
    return post.caption.slice(0, 80);
  }
  return `Instagram post by @${post.username}`;
}

export function mapIGPostToEvidence(post: IGHashtagPost): EvidenceRecord {
  return {
    id: `ig-social-post:${post.postId}`,
    createdAt: Date.now(),
    source: "instagram",
    evidenceType: "social_post",
    sourceUrl: post.postUrl,
    sourceId: post.postId,
    title: deriveTitle(post),
    text: post.caption,
    handle: post.username,
    name: post.username ? `@${post.username}` : deriveTitle(post),
    instagram: post.profileUrl || undefined,
    raw: post,
    // Store scraper-only fields in metadata so the Evidence Lake keeps post-level
    // context without forcing resolver-specific semantics onto the record shape.
    metadata: {
      platform: "instagram",
      profileUrl: post.profileUrl,
      hashtags: post.hashtags,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      timestamp: post.timestamp,
      weeksAgo: post.weeksAgo,
    },
  };
}
