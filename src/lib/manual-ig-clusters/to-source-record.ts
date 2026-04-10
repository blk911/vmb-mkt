import type { ManualIgAcceptedRecord } from "./types";

export function mapManualIgAcceptedToSourceSeed(record: ManualIgAcceptedRecord) {
  return {
    source: "manual_ig_cluster",
    evidenceType: "social_seed",
    platform: "instagram",
    externalId: `ig:${record.handle}`,
    handle: record.handle,
    displayName: record.displayName,
    categoryGuess: record.categoryGuess,
    confidence: record.confidence,
    sourceMeta: {
      clusterId: record.clusterId,
      originHandle: record.originHandle,
      captureMethod: record.captureMethod,
      acceptedAt: record.acceptedAt,
      market: record.market,
      tags: record.tags ?? [],
    },
  };
}
