import type { SourceRecord } from "@/lib/operators/types";
import { getContainerRegistryEntry } from "./container-registry";
import { extractContainerTenants, type ContainerExtractorResult } from "./container-extractors";

export type ContainerExtractionOutput = ContainerExtractorResult & {
  detected: boolean;
  strategy?: string;
};

export async function runContainerExtraction(input: {
  sourceUrl: string;
  html: string;
  candidate: SourceRecord;
}): Promise<ContainerExtractionOutput> {
  const registryEntry = getContainerRegistryEntry(input.sourceUrl);
  if (!registryEntry) {
    return {
      detected: false,
      parentContainerId: "",
      parentContainerName: undefined,
      tenantCandidates: [],
      followOnDetailUrls: [],
    };
  }

  const extracted = await extractContainerTenants({
    containerUrl: input.sourceUrl,
    html: input.html,
    candidate: input.candidate,
    registryEntry,
  });

  return {
    detected: true,
    strategy: registryEntry.strategy,
    ...extracted,
  };
}
