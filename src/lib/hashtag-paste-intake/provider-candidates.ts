import crypto from "node:crypto";
import type { HashtagPasteIntakeRequest, ParsedSocialPost, ProviderCandidate } from "./types";

type MutableCandidate = {
  handle: string;
  displayName?: string;
  serviceHint?: string;
  geoHint?: string;
  evidencePostIds: Set<string>;
  taggedByCount: number;
  providerSignalCount: number;
  clientSignalCount: number;
  reasons: Set<string>;
};

function confidenceForCandidate(candidate: MutableCandidate): ProviderCandidate["confidence"] {
  if ((candidate.providerSignalCount >= 1 && candidate.taggedByCount >= 2) || candidate.providerSignalCount >= 2) {
    return "High";
  }
  if (candidate.providerSignalCount >= 1 || candidate.taggedByCount >= 2) {
    return "Medium";
  }
  return "Low";
}

export function buildProviderCandidates(
  parsedPosts: ParsedSocialPost[],
  request: HashtagPasteIntakeRequest
): ProviderCandidate[] {
  const candidates = new Map<string, MutableCandidate>();

  function getCandidate(handle: string): MutableCandidate {
    const normalizedHandle = handle.toLowerCase();
    const existing = candidates.get(normalizedHandle);
    if (existing) return existing;
    const next: MutableCandidate = {
      handle: normalizedHandle,
      displayName: undefined,
      serviceHint: undefined,
      geoHint: request.geoHint?.trim() || undefined,
      evidencePostIds: new Set<string>(),
      taggedByCount: 0,
      providerSignalCount: 0,
      clientSignalCount: 0,
      reasons: new Set<string>(),
    };
    candidates.set(normalizedHandle, next);
    return next;
  }

  for (const post of parsedPosts) {
    if (post.handle && post.inferredType === "provider") {
      // Main handles on provider-like posts are the strongest source of identity.
      const candidate = getCandidate(post.handle);
      candidate.displayName = candidate.displayName || post.displayName;
      candidate.serviceHint = candidate.serviceHint || post.inferredServiceHint || request.serviceHint?.trim() || undefined;
      candidate.geoHint = candidate.geoHint || post.inferredGeoHint || request.geoHint?.trim() || undefined;
      candidate.providerSignalCount += 1;
      candidate.evidencePostIds.add(post.id);
      candidate.reasons.add("main handle appears on provider-like post");
      if (post.reasons.length) candidate.reasons.add(post.reasons[0]);
    }

    for (const taggedHandle of post.taggedHandles) {
      const candidate = getCandidate(taggedHandle);
      candidate.displayName = candidate.displayName || post.displayName;
      candidate.serviceHint = candidate.serviceHint || post.inferredServiceHint || request.serviceHint?.trim() || undefined;
      candidate.geoHint = candidate.geoHint || post.inferredGeoHint || request.geoHint?.trim() || undefined;
      candidate.evidencePostIds.add(post.id);
      if (post.inferredType === "client") {
        candidate.taggedByCount += 1;
        candidate.clientSignalCount += 1;
        candidate.reasons.add("tagged repeatedly across client-like posts");
      } else if (post.inferredType === "provider") {
        candidate.taggedByCount += 1;
        candidate.reasons.add("tagged inside provider-like post");
      }
    }
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.providerSignalCount >= 1 || candidate.taggedByCount >= 2 || candidate.clientSignalCount >= 2)
    .map((candidate) => {
      const confidence = confidenceForCandidate(candidate);
      return {
        id: `hpi_candidate_${crypto.createHash("md5").update(candidate.handle).digest("hex").slice(0, 12)}`,
        handle: candidate.handle,
        displayName: candidate.displayName,
        serviceHint: candidate.serviceHint,
        geoHint: candidate.geoHint,
        evidencePostIds: [...candidate.evidencePostIds],
        taggedByCount: candidate.taggedByCount,
        providerSignalCount: candidate.providerSignalCount,
        clientSignalCount: candidate.clientSignalCount,
        confidence,
        reasons: [...candidate.reasons],
      } satisfies ProviderCandidate;
    })
    .sort((a, b) => {
      const scoreA = a.providerSignalCount * 3 + a.taggedByCount * 2 + a.clientSignalCount;
      const scoreB = b.providerSignalCount * 3 + b.taggedByCount * 2 + b.clientSignalCount;
      return scoreB - scoreA || a.handle.localeCompare(b.handle);
    });
}
