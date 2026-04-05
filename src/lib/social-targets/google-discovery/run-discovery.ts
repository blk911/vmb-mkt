import { ingestSourceCandidateInputs } from "@/lib/social-targets/social-candidate-logic";
import {
  adaptGoogleResultsToSourceCandidates,
  adaptGoogleResultsToEvidenceItems,
  type GoogleResult,
} from "@/lib/social-targets/google-discovery/google-results-adapter";
import {
  buildGoogleDiscoveryPack as buildDiscoveryPack,
  type DiscoveryAnchor,
  type GoogleDiscoveryPack,
  type GoogleQuery,
} from "@/lib/social-targets/google-discovery/query-generator";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";
import type { SocialEvidenceItem, SocialTarget } from "@/types/social-target";

export type GoogleQueryResultSet = {
  query: GoogleQuery;
  results: GoogleResult[];
};

function sourceCandidateKey(input: SourceCandidateInput): string {
  return `${input.platform ?? "unknown"}|${(input.handle ?? "").toLowerCase()}|${(input.profileUrl ?? "").toLowerCase()}`;
}

export function buildGoogleDiscoveryPack(anchor: DiscoveryAnchor): GoogleDiscoveryPack {
  return buildDiscoveryPack(anchor);
}

export function buildGoogleDiscoveryQueries(anchor: DiscoveryAnchor): GoogleDiscoveryPack {
  return buildGoogleDiscoveryPack(anchor);
}

export function adaptGoogleResultsWithQuery(
  results: GoogleResult[],
  query: GoogleQuery,
  anchor: DiscoveryAnchor
): SourceCandidateInput[] {
  return adaptGoogleResultsToSourceCandidates(results, query, anchor);
}

export function adaptQueryResultsToCandidates(
  queryResults: GoogleQueryResultSet[],
  anchor: DiscoveryAnchor
): SourceCandidateInput[] {
  const dedup = new Set<string>();
  const inputs: SourceCandidateInput[] = [];
  for (const group of queryResults) {
    const adapted = adaptGoogleResultsWithQuery(group.results, group.query, anchor);
    for (const input of adapted) {
      const key = sourceCandidateKey(input);
      if (dedup.has(key)) continue;
      dedup.add(key);
      inputs.push(input);
    }
  }
  return inputs;
}

export function adaptQueryResultsToEvidence(
  queryResults: GoogleQueryResultSet[],
  anchor: DiscoveryAnchor
): SocialEvidenceItem[] {
  const dedup = new Set<string>();
  const items: SocialEvidenceItem[] = [];
  for (const group of queryResults) {
    const adapted = adaptGoogleResultsToEvidenceItems(group.results, group.query, anchor);
    for (const item of adapted) {
      const key = `${item.type}|${item.platform ?? ""}|${(item.url ?? "").toLowerCase()}`;
      if (dedup.has(key)) continue;
      dedup.add(key);
      items.push(item);
    }
  }
  return items;
}

export function runGoogleDiscovery(
  target: SocialTarget,
  anchor: DiscoveryAnchor,
  queryResults: GoogleQueryResultSet[]
): { target: SocialTarget; pack: GoogleDiscoveryPack; inputs: SourceCandidateInput[]; evidence: SocialEvidenceItem[] } {
  const pack = buildGoogleDiscoveryPack(anchor);
  const inputs = adaptQueryResultsToCandidates(queryResults, anchor);
  const evidence = adaptQueryResultsToEvidence(queryResults, anchor);
  const nextTarget = ingestSourceCandidateInputs(target, inputs);
  return { target: nextTarget, pack, inputs, evidence };
}
