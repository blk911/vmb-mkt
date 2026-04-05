import {
  appendEvidenceToTarget,
  classifyEvidenceTypeFromUrl,
  createEvidenceItem,
  domainTypeForUrl,
  extractHandleFromUrl,
  extractOperatorNameFromResult,
  isBookingPlatformUrl,
  nameSimilarityScore,
} from "@/lib/social-targets/evidence";
import {
  buildAddressExpansionQueryPack,
  type AddressExpansionAnchor,
  type AddressExpansionQuery,
  type AddressExpansionQueryPack,
} from "@/lib/social-targets/address-expansion/query-generator";
import {
  classifyAddressExpansion,
  normalizeAddressKey,
  type AddressExpansionClassificationResult,
} from "@/lib/social-targets/address-expansion/classification";
import { scoreProspectCandidate } from "@/lib/social-targets/prospect/scoring";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import type { AddressExpansionCandidate, SocialEvidenceItem, SocialTarget } from "@/types/social-target";

export type AddressExpansionResultItem = {
  title: string;
  url: string;
  snippet?: string;
};

export type AddressExpansionQueryResultSet = {
  query: AddressExpansionQuery;
  results: AddressExpansionResultItem[];
};

export type AddressExpansionRunInput = {
  target: SocialTarget;
  allTargets?: SocialTarget[];
  sourceAddress?: string;
  normalizedAddress?: string;
  runId: string;
  runType: "validation" | "scale" | "adhoc" | "expansion_test";
  sourceVersion: string;
  queryResults?: AddressExpansionQueryResultSet[];
};

export type AddressExpansionRunOutput = {
  target: SocialTarget;
  queryPack: AddressExpansionQueryPack;
  classification: AddressExpansionClassificationResult;
  evidenceAdded: number;
  candidatesStaged: number;
  allCandidates: AddressExpansionCandidate[];
  usableCandidates: AddressExpansionCandidate[];
};

function dedupeCandidateKey(candidate: AddressExpansionCandidate): string {
  return [
    candidate.operatorName.toLowerCase(),
    candidate.platform ?? "",
    (candidate.handle ?? "").toLowerCase(),
    (candidate.url ?? "").toLowerCase(),
    (candidate.bookingUrl ?? "").toLowerCase(),
  ].join("|");
}

function confidenceRank(confidence: AddressExpansionCandidate["confidence"]): number {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function confidenceFromScore(score: number): AddressExpansionCandidate["confidence"] {
  if (score >= 0.78) return "high";
  if (score >= 0.52) return "medium";
  return "low";
}

function anchorFromTarget(
  target: SocialTarget,
  sourceAddress?: string,
  normalizedAddress?: string,
  classification?: AddressExpansionClassificationResult
): AddressExpansionAnchor {
  const variants = [
    target.businessName,
    target.handle.replace(/^@/, ""),
    target.verificationNote,
  ]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(1, 4);
  return {
    businessName: target.businessName,
    category: target.category,
    city: target.zone,
    zone: target.zone,
    address: sourceAddress ?? target.addressExpansion?.sourceAddress,
    normalizedAddress: normalizedAddress ?? target.normalizedAddress ?? target.addressExpansion?.normalizedAddress,
    phone: (target.evidence ?? []).find((ev) => ev.extracted.phone)?.extracted.phone,
    website: target.platforms?.instagram || target.platforms?.tiktok || target.platforms?.linktree,
    nameVariants: variants,
    aggregatorHint: classification?.aggregatorType,
  };
}

function classifyResultEvidenceType(query: AddressExpansionQuery, url: string): SocialEvidenceItem["type"] {
  if (query.category === "booking_platform") return "booking_platform";
  if (query.category === "directory_expansion") return "directory_expansion";
  if (query.category === "address_businesses") return "address_businesses";
  if (query.category === "aggregator_brand") return "aggregator_site";
  const fromUrl = classifyEvidenceTypeFromUrl(url);
  if (query.category === "address_suites" && fromUrl === "website") return "suite_operator";
  return fromUrl;
}

function buildEvidenceAndCandidates(
  target: SocialTarget,
  classification: AddressExpansionClassificationResult,
  queryResults: AddressExpansionQueryResultSet[],
  sourceAddress: string | undefined,
  runMeta: Pick<SocialTarget, "runId" | "runType" | "sourceVersion">
): { evidence: SocialEvidenceItem[]; candidates: AddressExpansionCandidate[] } {
  const evidence: SocialEvidenceItem[] = [];
  const candidates: AddressExpansionCandidate[] = [];
  const seenEvidence = new Set<string>();
  const seenCandidate = new Map<string, AddressExpansionCandidate>();
  const normalizedAddress = normalizeAddressKey(sourceAddress || classification.normalizedAddress);
  const business = target.businessName ?? target.handle.replace(/^@/, "");

  for (const group of queryResults) {
    for (const result of group.results) {
      const url = result.url?.trim();
      if (!url) continue;
      const evidenceType = classifyResultEvidenceType(group.query, url);
      const handle = extractHandleFromUrl(url);
      const operatorName = extractOperatorNameFromResult(result.title, result.snippet) ?? handle ?? "Unknown operator";
      const nameSimilarity = nameSimilarityScore(business, operatorName);
      const textBlob = `${result.title ?? ""} ${result.snippet ?? ""}`.toLowerCase();
      const geoMatch = target.zone ? textBlob.includes(target.zone.toLowerCase()) : classification.isLikelyMultiTenant;
      const phoneKnown = (target.evidence ?? []).find((ev) => ev.extracted.phone)?.extracted.phone;
      const phoneMatch = Boolean(phoneKnown && textBlob.includes(phoneKnown.replace(/[^\d]/g, "").slice(-7)));
      const domainMatch = target.platforms ? Object.values(target.platforms).some((u) => typeof u === "string" && u && url.includes(u)) : false;
      const score = nameSimilarity * 0.6 + (geoMatch ? 0.16 : 0) + (phoneMatch ? 0.12 : 0) + (domainMatch ? 0.08 : 0) + (isBookingPlatformUrl(url) ? 0.08 : 0);
      const confidence = confidenceFromScore(score);
      const evidenceItem = createEvidenceItem({
        type: evidenceType,
        url,
        title: result.title,
        snippet: result.snippet,
        sourceQuery: group.query.query,
        confidence,
        nameSimilarity,
        geoMatch,
        phoneMatch,
        domainMatch,
        handle,
        addressLink: sourceAddress ?? classification.normalizedAddress,
        domainType: domainTypeForUrl(url),
      });
      const evidenceKey = `${evidenceItem.type}|${(evidenceItem.url ?? "").toLowerCase()}|${evidenceItem.sourceQuery.toLowerCase()}`;
      if (!seenEvidence.has(evidenceKey)) {
        seenEvidence.add(evidenceKey);
        evidence.push(evidenceItem);
      }

      const candidate: AddressExpansionCandidate = {
        id: `axc-${evidenceItem.id}`,
        operatorName,
        ...(evidenceItem.platform ? { platform: evidenceItem.platform } : {}),
        ...(handle ? { handle } : {}),
        ...(url ? { url } : {}),
        ...(isBookingPlatformUrl(url) ? { bookingUrl: url } : {}),
        confidence,
        evidenceIds: [evidenceItem.id],
        discoveryMode: "address_expansion",
        ...(normalizedAddress ? { sourceAddress: normalizedAddress } : {}),
        parentTargetId: target.id,
        createdAt: evidenceItem.createdAt,
        notes: [group.query.category, `query:${group.query.query}`, `run:${runMeta.runId}`].join(" | "),
      };
      const cKey = dedupeCandidateKey(candidate);
      const prev = seenCandidate.get(cKey);
      if (!prev) {
        seenCandidate.set(cKey, candidate);
      } else {
        const better = confidenceRank(candidate.confidence) > confidenceRank(prev.confidence) ? candidate : prev;
        seenCandidate.set(cKey, {
          ...better,
          evidenceIds: [...new Set([...(prev.evidenceIds ?? []), ...(candidate.evidenceIds ?? [])])],
        });
      }
    }
  }

  for (const candidate of seenCandidate.values()) candidates.push(candidate);
  candidates.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
  return { evidence, candidates: candidates.slice(0, 60) };
}

export function runAddressExpansion(input: AddressExpansionRunInput): AddressExpansionRunOutput {
  const classification = classifyAddressExpansion({
    target: input.target,
    allTargets: input.allTargets,
    sourceAddress: input.sourceAddress,
    normalizedAddress: input.normalizedAddress,
  });
  const anchor = anchorFromTarget(input.target, input.sourceAddress, input.normalizedAddress, classification);
  const queryPack = buildAddressExpansionQueryPack(anchor, classification);
  const queryResults = input.queryResults ?? [];
  const { evidence, candidates } = buildEvidenceAndCandidates(
    input.target,
    classification,
    queryResults,
    input.sourceAddress,
    {
      runId: input.runId,
      runType: input.runType,
      sourceVersion: input.sourceVersion,
    }
  );
  const next = appendEvidenceToTarget(input.target, evidence, {
    runId: input.runId,
    runType: input.runType,
    sourceVersion: input.sourceVersion,
  });
  const mergedCandidates = [
    ...(next.addressExpansion?.candidates ?? []),
    ...candidates,
  ];
  const dedupedCandidates = new Map<string, AddressExpansionCandidate>();
  for (const candidate of mergedCandidates) {
    const key = dedupeCandidateKey(candidate);
    const prev = dedupedCandidates.get(key);
    if (!prev || confidenceRank(candidate.confidence) > confidenceRank(prev.confidence)) {
      dedupedCandidates.set(key, candidate);
    }
  }
  const evidenceById = new Map((next.evidence ?? []).map((item) => [item.id, item]));
  const scoredCandidates = [...dedupedCandidates.values()].map((candidate) => ({
    ...candidate,
    prospect: scoreProspectCandidate({
      candidate,
      evidenceById,
      sourceAddress: input.sourceAddress ?? classification.normalizedAddress,
      city: input.target.zone,
    }),
  }));
  scoredCandidates.sort((a, b) => {
    const ar = a.prospect?.readinessScore ?? 0;
    const br = b.prospect?.readinessScore ?? 0;
    if (ar !== br) return br - ar;
    return confidenceRank(b.confidence) - confidenceRank(a.confidence);
  });
  const usableCandidates = scoredCandidates.filter(
    (candidate) => candidate.prospect?.tier === "hot" || candidate.prospect?.tier === "warm"
  );
  const prospectCounts = {
    hot: scoredCandidates.filter((candidate) => candidate.prospect?.tier === "hot").length,
    warm: scoredCandidates.filter((candidate) => candidate.prospect?.tier === "warm").length,
    cold: scoredCandidates.filter((candidate) => candidate.prospect?.tier === "cold").length,
    exclude: scoredCandidates.filter((candidate) => candidate.prospect?.tier === "exclude").length,
  };
  const target = normalizeSocialTarget({
    ...next,
    ...(classification.normalizedAddress ? { normalizedAddress: classification.normalizedAddress } : {}),
    addressExpansion: {
      ...(next.addressExpansion ?? {}),
      sourceAddress: input.sourceAddress ?? next.addressExpansion?.sourceAddress,
      normalizedAddress: classification.normalizedAddress ?? next.addressExpansion?.normalizedAddress,
      classification: {
        isLikelyMultiTenant: classification.isLikelyMultiTenant,
        aggregatorType: classification.aggregatorType,
        addressDensityScore: classification.addressDensityScore,
        expansionPriority: classification.expansionPriority,
      },
      queryCount: queryPack.queries.length,
      candidateCount: scoredCandidates.length,
      usableCandidateCount: usableCandidates.length,
      prospectCounts,
      candidates: usableCandidates.slice(0, 120),
      lastRunId: input.runId,
      lastRunType: input.runType,
      sourceVersion: input.sourceVersion,
      updatedAt: new Date().toISOString(),
    },
  });
  return {
    target,
    queryPack,
    classification,
    evidenceAdded: evidence.length,
    candidatesStaged: usableCandidates.length,
    allCandidates: scoredCandidates,
    usableCandidates,
  };
}
