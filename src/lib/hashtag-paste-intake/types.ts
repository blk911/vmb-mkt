export type SocialPlatform = "instagram";

export interface HashtagPasteIntakeRequest {
  platform: SocialPlatform;
  hashtag?: string;
  geoHint?: string;
  serviceHint?: string;
  rawText: string;
}

export interface ParsedSocialPost {
  id: string;
  rawBlock: string;
  handle?: string;
  displayName?: string;
  caption?: string;
  hashtags: string[];
  taggedHandles: string[];
  urls: string[];
  inferredType: "provider" | "client" | "unknown";
  inferredServiceHint?: string;
  inferredGeoHint?: string;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
}

export interface ProviderCandidate {
  id: string;
  handle: string;
  displayName?: string;
  serviceHint?: string;
  geoHint?: string;
  evidencePostIds: string[];
  taggedByCount: number;
  providerSignalCount: number;
  clientSignalCount: number;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
}

export interface HashtagPasteIntakeResult {
  request: HashtagPasteIntakeRequest;
  parsedPosts: ParsedSocialPost[];
  providerCandidates: ProviderCandidate[];
  taggedHandles: Array<{
    handle: string;
    count: number;
  }>;
  clientSignalPosts: ParsedSocialPost[];
  diagnostics: string[];
}

export interface HashtagPasteSnapshot {
  id: string;
  createdAt: string;
  result: HashtagPasteIntakeResult;
}
