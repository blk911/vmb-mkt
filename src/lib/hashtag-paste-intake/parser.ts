import crypto from "node:crypto";
import type { HashtagPasteIntakeRequest, ParsedSocialPost } from "./types";

const HANDLE_REGEX = /@([a-z0-9._]{2,30})/gi;
const HASHTAG_REGEX = /#([a-z0-9_]+)/gi;
const URL_REGEX = /https?:\/\/[^\s]+/gi;

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bdm to book\b/i, reason: "contains 'dm to book'" },
  { pattern: /\blink in bio\b/i, reason: "contains 'link in bio'" },
  { pattern: /\b(book|booking|appointments?|available)\b/i, reason: "contains booking language" },
  { pattern: /\b(licensed|nail tech|stylist|artist|studio|suite|services?)\b/i, reason: "contains provider identity language" },
  { pattern: /\b(gel x|acrylic|manicure|pedicure|brows|lashes|wax|spa)\b/i, reason: "contains service language" },
  { pattern: /\b(located in|denver nail tech|denver|aurora|lakewood)\b/i, reason: "contains location/provider phrasing" },
];

const CLIENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bmy girl\b/i, reason: "contains client referral phrasing" },
  { pattern: /\bmy nail tech\b/i, reason: "contains client/provider relationship phrasing" },
  { pattern: /\b(obsessed|love her work|favorite)\b/i, reason: "contains client praise language" },
  { pattern: /\b(did my nails|she did|look what she did)\b/i, reason: "contains client result language" },
  { pattern: /\b(go to her|highly recommend|sent me)\b/i, reason: "contains recommendation language" },
  { pattern: /\btagged my\b/i, reason: "contains tagged-client phrasing" },
];

const SERVICE_HINT_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bgel x\b/i, value: "Gel X" },
  { pattern: /\bacrylic\b/i, value: "Acrylic" },
  { pattern: /\bmanicure\b/i, value: "Manicure" },
  { pattern: /\bpedicure\b/i, value: "Pedicure" },
  { pattern: /\bbrows?\b/i, value: "Brows" },
  { pattern: /\blashes?\b/i, value: "Lashes" },
  { pattern: /\bwax\b/i, value: "Wax" },
];

const GEO_HINT_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bdenver\b/i, value: "Denver" },
  { pattern: /\baurora\b/i, value: "Aurora" },
  { pattern: /\blakewood\b/i, value: "Lakewood" },
  { pattern: /\benglewood\b/i, value: "Englewood" },
];

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))];
}

function collectMatches(regex: RegExp, input: string, formatter?: (value: string) => string): string[] {
  const matches = Array.from(input.matchAll(regex));
  return uniqueStrings(matches.map((match) => (formatter ? formatter(match[1] || match[0]) : match[1] || match[0])));
}

function splitIntoBlocks(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Instagram paste content is often messy, so we first honor blank lines and then
  // fall back to starting a new block when a fresh handle line appears after content.
  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }

    if (/^@[a-z0-9._]{2,30}\b/i.test(trimmed) && current.length >= 2) {
      blocks.push(current.join("\n").trim());
      current = [trimmed];
      continue;
    }

    current.push(trimmed);
  }

  if (current.length) blocks.push(current.join("\n").trim());
  return blocks.filter(Boolean);
}

function extractDisplayName(lines: string[], handle?: string): string | undefined {
  const line = lines.find((entry) => !/^[@#]/.test(entry) && !/^https?:\/\//i.test(entry) && entry.length <= 60);
  if (!line) return undefined;
  return handle ? line.replace(new RegExp(`@${handle}\\b`, "i"), "").trim() || undefined : line;
}

function extractCaption(lines: string[]): string | undefined {
  const captionLines = lines.filter((entry) => !/^https?:\/\//i.test(entry));
  const caption = captionLines.join(" ").replace(/\s+/g, " ").trim();
  return caption || undefined;
}

function inferServiceHint(text: string, request: HashtagPasteIntakeRequest): string | undefined {
  for (const hint of SERVICE_HINT_PATTERNS) {
    if (hint.pattern.test(text)) return hint.value;
  }
  return request.serviceHint?.trim() || undefined;
}

function inferGeoHint(text: string, request: HashtagPasteIntakeRequest): string | undefined {
  for (const hint of GEO_HINT_PATTERNS) {
    if (hint.pattern.test(text)) return hint.value;
  }
  return request.geoHint?.trim() || undefined;
}

function isPotentialBareHandle(line: string): boolean {
  const value = line.trim();
  if (!/^[a-z0-9._]{2,30}$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  return value === value.toLowerCase() || /[._\d]/.test(value);
}

function buildBareHandleListPosts(request: HashtagPasteIntakeRequest): ParsedSocialPost[] {
  const lines = request.rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const posts: ParsedSocialPost[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const handleLine = lines[index];
    if (!isPotentialBareHandle(handleLine)) continue;

    const displayNameLine = lines[index + 1];
    const hasDisplayName = Boolean(displayNameLine) && !isPotentialBareHandle(displayNameLine);
    const rawBlock = hasDisplayName ? `${handleLine}\n${displayNameLine}` : handleLine;
    const handle = handleLine.replace(/^@/, "").toLowerCase();

    posts.push({
      id: `hpi_post_${crypto.createHash("md5").update(rawBlock).digest("hex").slice(0, 12)}`,
      rawBlock,
      handle,
      displayName: hasDisplayName ? displayNameLine : undefined,
      caption: hasDisplayName ? `${handleLine} ${displayNameLine}` : handleLine,
      hashtags: [],
      taggedHandles: [],
      urls: [],
      inferredType: "provider",
      inferredServiceHint: inferServiceHint(rawBlock, request),
      inferredGeoHint: inferGeoHint(rawBlock, request),
      confidence: hasDisplayName ? "High" : "Medium",
      reasons: ["bare handle list entry"],
    });

    if (hasDisplayName) {
      index += 1;
    }
  }

  return posts;
}

export function parseHashtagPasteRequest(request: HashtagPasteIntakeRequest): {
  parsedPosts: ParsedSocialPost[];
  diagnostics: string[];
} {
  const blocks = splitIntoBlocks(request.rawText);
  const diagnostics: string[] = [];
  if (request.rawText.trim().length < 80) diagnostics.push("very short pasted input");

  let parsedPosts = blocks.map((block) => {
    const blockId = `hpi_post_${crypto.createHash("md5").update(block).digest("hex").slice(0, 12)}`;
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const handles = collectMatches(HANDLE_REGEX, block, (value) => value.toLowerCase());
    const hashtags = collectMatches(HASHTAG_REGEX, block, (value) => `#${value.toLowerCase()}`);
    const urls = collectMatches(URL_REGEX, block, (value) => value);
    const handle = handles[0];
    const taggedHandles = handles.slice(1);
    const caption = extractCaption(lines);
    const displayName = extractDisplayName(lines, handle);
    const reasons: string[] = [];

    const providerReasons = PROVIDER_PATTERNS.filter((entry) => entry.pattern.test(block)).map((entry) => entry.reason);
    const clientReasons = CLIENT_PATTERNS.filter((entry) => entry.pattern.test(block)).map((entry) => entry.reason);
    if (handle) reasons.push("handle found");
    reasons.push(...providerReasons, ...clientReasons);

    let inferredType: ParsedSocialPost["inferredType"] = "unknown";
    if (providerReasons.length > clientReasons.length && providerReasons.length > 0) inferredType = "provider";
    if (clientReasons.length > providerReasons.length && clientReasons.length > 0) inferredType = "client";
    if (providerReasons.length > 0 && clientReasons.length > 0 && taggedHandles.length >= 1) inferredType = "client";

    let confidence: ParsedSocialPost["confidence"] = "Low";
    if (handle && Math.max(providerReasons.length, clientReasons.length) >= 1) confidence = "High";
    else if (handle || providerReasons.length > 0 || clientReasons.length > 0) confidence = "Medium";

    return {
      id: blockId,
      rawBlock: block,
      handle,
      displayName,
      caption,
      hashtags,
      taggedHandles,
      urls,
      inferredType,
      inferredServiceHint: inferServiceHint(block, request),
      inferredGeoHint: inferGeoHint(block, request),
      confidence,
      reasons: uniqueStrings(reasons),
    } satisfies ParsedSocialPost;
  });

  if (!parsedPosts.some((post) => post.handle)) {
    const bareHandleListPosts = buildBareHandleListPosts(request);
    if (bareHandleListPosts.length) {
      parsedPosts = bareHandleListPosts;
      diagnostics.push("parsed bare instagram handle list format");
    }
  }

  if (!parsedPosts.some((post) => post.handle)) diagnostics.push("no handles found");
  if (!parsedPosts.some((post) => post.inferredType === "client")) diagnostics.push("no client-signal posts identified");
  if (parsedPosts.length && parsedPosts.filter((post) => post.confidence === "Low").length >= Math.ceil(parsedPosts.length * 0.7)) {
    diagnostics.push("low parse confidence overall");
  }

  const duplicateHandleCount = (() => {
    const counts = new Map<string, number>();
    for (const post of parsedPosts) {
      for (const handle of [post.handle, ...post.taggedHandles].filter(Boolean) as string[]) {
        counts.set(handle, (counts.get(handle) || 0) + 1);
      }
    }
    return [...counts.values()].filter((count) => count >= 3).length;
  })();
  if (duplicateHandleCount >= 2) diagnostics.push("heavy duplicate handles detected");

  return { parsedPosts, diagnostics };
}
