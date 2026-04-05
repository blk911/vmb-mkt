import type { AddressExpansionCandidate, CandidateType, ProspectTier, SocialEvidenceItem } from "@/types/social-target";
import { classifyProspectCandidate } from "@/lib/social-targets/prospect/classification";
import { computeProspectAddressMatch } from "@/lib/social-targets/prospect/address-match";

const OPERATOR_WEIGHT: Record<CandidateType, number> = {
  operator: 30,
  booking_operator: 25,
  aggregator: -20,
  directory: -25,
  ambiguous: 0,
};

export function prospectTierFromScore(score: number): ProspectTier {
  if (score >= 70) return "hot";
  if (score >= 50) return "warm";
  if (score >= 30) return "cold";
  return "exclude";
}

export function scoreProspectCandidate(input: {
  candidate: AddressExpansionCandidate;
  evidenceById: Map<string, SocialEvidenceItem>;
  sourceAddress?: string;
  city?: string;
}): {
  type: CandidateType;
  readinessScore: number;
  tier: ProspectTier;
  addressMatch: ReturnType<typeof computeProspectAddressMatch>;
} {
  const type = classifyProspectCandidate(input.candidate, input.evidenceById);
  const addressMatch = computeProspectAddressMatch({
    candidate: input.candidate,
    evidenceById: input.evidenceById,
    sourceAddress: input.sourceAddress,
    city: input.city,
  });
  const evidence = input.candidate.evidenceIds
    .map((id) => input.evidenceById.get(id))
    .filter((x): x is SocialEvidenceItem => Boolean(x));
  const hasInstagram = input.candidate.platform === "instagram" || evidence.some((item) => item.type === "instagram");
  const hasTikTok = input.candidate.platform === "tiktok" || evidence.some((item) => item.type === "tiktok");
  const hasLinktree = input.candidate.platform === "linktree" || evidence.some((item) => item.type === "linktree");
  const hasBooking = Boolean(input.candidate.bookingUrl) || evidence.some((item) => item.type === "booking_platform" || item.domainType === "booking_platform");
  const evidenceCountScore = evidence.length >= 3 ? 10 : 0;
  const platformScore = (hasInstagram ? 10 : 0) + (hasTikTok ? 5 : 0) + (hasLinktree ? 10 : 0) + (hasBooking ? 20 : 0);
  const aggregatorPenalty = type === "aggregator" ? 20 : 0;
  const ambiguityPenalty = type === "ambiguous" ? 15 : 0;

  const score =
    OPERATOR_WEIGHT[type] +
    addressMatch.score +
    platformScore +
    evidenceCountScore -
    aggregatorPenalty -
    ambiguityPenalty;
  const readinessScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    type,
    readinessScore,
    tier: prospectTierFromScore(readinessScore),
    addressMatch,
  };
}
