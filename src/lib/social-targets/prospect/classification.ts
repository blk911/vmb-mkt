import type { AddressExpansionCandidate, CandidateType, SocialEvidenceItem } from "@/types/social-target";

const AGGREGATOR_BRAND_TOKENS = [
  "sola",
  "phenix",
  "salons by jc",
  "salonsbyjc",
  "my salon suite",
  "mysalon",
  "image studios",
  "imagestudios",
  "spectra",
] as const;

const AGGREGATOR_SOFT_TOKENS = [
  "salon suites",
  "suites",
  "studios",
  "location",
  "directory",
] as const;

const DIRECTORY_TOKENS = ["yelp", "top 10", "listing", "mapquest", "yellowpages"] as const;

const BOOKING_HOST_TOKENS = ["glossgenius", "vagaro", "styleseat", "booksy", "fresha", "square.site", "squareup"] as const;

function textParts(candidate: AddressExpansionCandidate, evidence: SocialEvidenceItem[]): string {
  const parts = [candidate.operatorName, candidate.url, candidate.bookingUrl, candidate.notes];
  for (const item of evidence) parts.push(item.title, item.snippet, item.url);
  return parts.filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(" ").toLowerCase();
}

function containsAny(text: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function hasOperatorSignal(candidate: AddressExpansionCandidate, evidence: SocialEvidenceItem[]): boolean {
  const hasSocial = evidence.some((item) => item.type === "instagram" || item.type === "tiktok" || item.type === "linktree");
  const hasBooking = Boolean(candidate.bookingUrl) || evidence.some((item) => item.type === "booking_platform");
  const name = candidate.operatorName.toLowerCase();
  const personalCue =
    /\bby\s+[a-z]/i.test(name) ||
    /@\w/.test(name) ||
    /\b(studio|artist|barber|stylist|brows|lashes|nails|spa)\b/i.test(name);
  return (hasSocial || hasBooking) && personalCue;
}

export function classifyProspectCandidate(
  candidate: AddressExpansionCandidate,
  evidenceById: Map<string, SocialEvidenceItem>
): CandidateType {
  const evidence = candidate.evidenceIds.map((id) => evidenceById.get(id)).filter((x): x is SocialEvidenceItem => Boolean(x));
  const text = textParts(candidate, evidence);
  const operatorLike = hasOperatorSignal(candidate, evidence);
  const hasBooking = Boolean(candidate.bookingUrl) || evidence.some((item) => item.type === "booking_platform" || item.domainType === "booking_platform");

  const hasAggregatorEvidence = evidence.some((item) => item.type === "aggregator_site" || item.type === "suite_operator");
  if (
    hasAggregatorEvidence ||
    containsAny(text, AGGREGATOR_BRAND_TOKENS) ||
    (containsAny(text, AGGREGATOR_SOFT_TOKENS) && !operatorLike && !hasBooking)
  ) {
    return "aggregator";
  }

  const hasDirectoryEvidence = evidence.some((item) => item.type === "directory" || item.type === "directory_expansion");
  if (hasDirectoryEvidence || containsAny(text, DIRECTORY_TOKENS)) return "directory";

  if (hasBooking && !containsAny(text, AGGREGATOR_BRAND_TOKENS)) {
    if (operatorLike || containsAny(text, BOOKING_HOST_TOKENS)) return "booking_operator";
  }

  if (operatorLike) return "operator";
  return "ambiguous";
}
