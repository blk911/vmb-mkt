import { detectAggregatorTypeFromText } from "@/lib/social-targets/evidence";
import type { AddressExpansionAggregatorType, AddressExpansionClassification, SocialTarget } from "@/types/social-target";

export type AddressExpansionClassificationInput = {
  target: SocialTarget;
  allTargets?: SocialTarget[];
  sourceAddress?: string;
  normalizedAddress?: string;
};

export type AddressExpansionClassificationResult = AddressExpansionClassification & {
  normalizedAddress?: string;
  operatorCountAtAddress: number;
  hints: string[];
};

export function normalizeAddressKey(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aggregatorFromTarget(target: SocialTarget, address?: string): AddressExpansionAggregatorType | undefined {
  const candidates = [
    target.businessName,
    target.notes,
    target.verificationNote,
    target.platforms?.instagram,
    target.platforms?.tiktok,
    target.platforms?.linktree,
    address,
  ]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" | ");
  return detectAggregatorTypeFromText(candidates);
}

function countOperatorsAtAddress(target: SocialTarget, allTargets: SocialTarget[], normalizedAddress: string): number {
  if (!normalizedAddress) return 0;
  return allTargets.filter((row) => {
    const rowAddress = normalizeAddressKey(row.normalizedAddress ?? row.addressExpansion?.normalizedAddress ?? row.addressExpansion?.sourceAddress);
    return rowAddress && rowAddress === normalizedAddress;
  }).length;
}

export function classifyAddressExpansion(input: AddressExpansionClassificationInput): AddressExpansionClassificationResult {
  const allTargets = input.allTargets ?? [input.target];
  const normalizedAddress = normalizeAddressKey(
    input.normalizedAddress ??
      input.sourceAddress ??
      input.target.normalizedAddress ??
      input.target.addressExpansion?.normalizedAddress ??
      input.target.addressExpansion?.sourceAddress
  );
  const aggregatorType = aggregatorFromTarget(input.target, input.sourceAddress);
  const operatorCountAtAddress = countOperatorsAtAddress(input.target, allTargets, normalizedAddress);
  const hasBookingSignal = (input.target.evidence ?? []).some(
    (ev) => ev.type === "booking_platform" || ev.domainType === "booking_platform"
  );
  const hasSuiteSignal =
    Boolean(aggregatorType) ||
    (input.target.evidence ?? []).some((ev) => ev.type === "suite_operator" || ev.type === "aggregator_site");

  let addressDensityScore = 0;
  if (operatorCountAtAddress >= 5) addressDensityScore = 95;
  else if (operatorCountAtAddress >= 3) addressDensityScore = 78;
  else if (operatorCountAtAddress >= 2) addressDensityScore = 62;
  else if (operatorCountAtAddress === 1) addressDensityScore = 42;
  else addressDensityScore = normalizedAddress ? 26 : 10;
  if (hasSuiteSignal) addressDensityScore += 14;
  if (hasBookingSignal) addressDensityScore += 8;
  if (input.target.evidence && input.target.evidence.length >= 3) addressDensityScore += 5;
  addressDensityScore = Math.max(0, Math.min(100, Math.round(addressDensityScore)));

  const isLikelyMultiTenant = Boolean(aggregatorType) || hasSuiteSignal || operatorCountAtAddress >= 3 || addressDensityScore >= 70;
  const expansionPriority: AddressExpansionClassification["expansionPriority"] =
    isLikelyMultiTenant && addressDensityScore >= 80
      ? "high"
      : isLikelyMultiTenant || addressDensityScore >= 55
        ? "medium"
        : "low";

  const hints: string[] = [];
  if (aggregatorType) hints.push(`aggregator:${aggregatorType}`);
  if (operatorCountAtAddress > 1) hints.push(`operators_at_address:${operatorCountAtAddress}`);
  if (hasBookingSignal) hints.push("booking_platform_signal");
  if (hasSuiteSignal) hints.push("suite_signal");
  if (!normalizedAddress) hints.push("address_missing");

  return {
    isLikelyMultiTenant,
    ...(aggregatorType ? { aggregatorType } : {}),
    addressDensityScore,
    expansionPriority,
    normalizedAddress: normalizedAddress || undefined,
    operatorCountAtAddress,
    hints,
  };
}
