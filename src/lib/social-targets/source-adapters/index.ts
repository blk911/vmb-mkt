import { adaptDoraRecord } from "@/lib/social-targets/source-adapters/dora";
import { adaptGoogleMapsRecord } from "@/lib/social-targets/source-adapters/google-maps";
import type { SourceCandidateInput, SourceType } from "@/lib/social-targets/source-adapters/types";
import { adaptWebsiteRecord } from "@/lib/social-targets/source-adapters/website";
import { adaptYelpRecord } from "@/lib/social-targets/source-adapters/yelp";

export type { SourceCandidateInput, SourceLiveHint, SourceTrustTier, SourceType } from "@/lib/social-targets/source-adapters/types";

export function adaptSourceRecord(sourceType: SourceType, rawRecord: unknown): SourceCandidateInput[] {
  switch (sourceType) {
    case "google_maps":
      return adaptGoogleMapsRecord(rawRecord);
    case "yelp":
      return adaptYelpRecord(rawRecord);
    case "dora":
      return adaptDoraRecord(rawRecord);
    case "website":
      return adaptWebsiteRecord(rawRecord);
    default:
      return [];
  }
}

