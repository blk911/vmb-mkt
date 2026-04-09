import crypto from "node:crypto";
import type { EvidenceRecord } from "@/lib/evidence/types";
import type { ResolverOperator } from "./types";
import { normalizeAddress, normalizeCity, normalizeDomain, normalizeName, normalizePhone } from "./normalize";

type TierName = "tier1" | "tier2" | "tier3" | "global_fallback";

type CandidateKeys = {
  tier1: string[];
  tier2: string[];
  tier3: string[];
};

export type CanonicalCandidateLookupResult = {
  tier1Candidates: ResolverOperator[];
  tier2Candidates: ResolverOperator[];
  tier3Candidates: ResolverOperator[];
  globalFallbackCandidates: ResolverOperator[];
  candidateSetSize: number;
  candidateLookupCount: number;
  usedGlobalFallback: boolean;
};

export type CanonicalCandidateIndex = {
  addOperator: (operator: ResolverOperator) => void;
  addEvidence: (operator: ResolverOperator, evidence: EvidenceRecord) => void;
  getCandidatesForEvidence: (evidence: EvidenceRecord, opts?: { allowGlobalFallback?: boolean }) => CanonicalCandidateLookupResult;
};

function normalizeInstagramHandle(value?: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return normalizeName(segments[0]?.replace(/^@/, ""));
  } catch {
    return normalizeName(value.split("/").filter(Boolean).pop());
  }
}

function normalizeBookingKey(value?: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.split("/").filter(Boolean).slice(0, 3).join("/");
    return `${parsed.hostname.replace(/^www\./, "").toLowerCase()}|${path}`;
  } catch {
    return "";
  }
}

function normalizeAddressPrefix(value?: string): string {
  const address = normalizeAddress(value);
  if (!address) return "";
  return address.split(" ").slice(0, 4).join(" ");
}

function namePrefix(value?: string): string {
  const name = normalizeName(value);
  if (!name) return "";
  return name.split(" ").slice(0, 2).join(" ");
}

function explicitParentContainerId(e: EvidenceRecord): string | undefined {
  const extractedId =
    e.extracted && typeof e.extracted === "object" && "parentContainerId" in (e.extracted as Record<string, unknown>)
      ? (e.extracted as Record<string, unknown>).parentContainerId
      : undefined;
  const rawId =
    e.raw && typeof e.raw === "object" && "parentContainerId" in (e.raw as Record<string, unknown>)
      ? (e.raw as Record<string, unknown>).parentContainerId
      : undefined;
  const id = (extractedId || rawId || "").toString().trim();
  return id || undefined;
}

function parentContainerIdFromEvidence(e: EvidenceRecord): string | undefined {
  const explicit = explicitParentContainerId(e);
  if (explicit) return explicit;
  return e.parentContainerName
    ? crypto.createHash("md5").update(normalizeName(e.parentContainerName)).digest("hex")
    : undefined;
}

function parentContainerIdFromOperator(op: ResolverOperator): string | undefined {
  if (op.parentContainerId) return op.parentContainerId;
  return op.parentContainerName
    ? crypto.createHash("md5").update(normalizeName(op.parentContainerName)).digest("hex")
    : undefined;
}

function operatorKeys(op: ResolverOperator): CandidateKeys {
  const name = normalizeName(op.canonicalName);
  const city = normalizeCity(op.canonicalCity);
  const address = normalizeAddress(op.canonicalAddress);
  const addressPrefix = normalizeAddressPrefix(op.canonicalAddress);
  const phone = normalizePhone(op.canonicalPhone);
  const domains = [op.canonicalWebsite, op.canonicalBooking, op.canonicalInstagram]
    .map((value) => normalizeDomain(value))
    .filter(Boolean);
  const instagramHandle = normalizeInstagramHandle(op.canonicalInstagram);
  const bookingKey = normalizeBookingKey(op.canonicalBooking);
  const parentContainerId = parentContainerIdFromOperator(op);
  const prefix = namePrefix(op.canonicalName);

  return {
    tier1: [
      phone ? `phone:${phone}` : "",
      ...domains.map((value) => `domain:${value}`),
      instagramHandle ? `instagram:${instagramHandle}` : "",
      bookingKey ? `booking:${bookingKey}` : "",
      name && city ? `name_city:${name}|${city}` : "",
      parentContainerId && name ? `parent_name:${parentContainerId}|${name}` : "",
    ].filter(Boolean),
    tier2: [
      address && city ? `address_city:${address}|${city}` : "",
      name ? `name:${name}` : "",
      address ? `address:${address}` : "",
      parentContainerId ? `parent:${parentContainerId}` : "",
    ].filter(Boolean),
    tier3: [
      prefix && city ? `city_prefix:${city}|${prefix}` : "",
      addressPrefix && city ? `addr_prefix_city:${addressPrefix}|${city}` : "",
      city ? `city:${city}` : "",
    ].filter(Boolean),
  };
}

function evidenceKeys(evidence: EvidenceRecord): CandidateKeys {
  const name = normalizeName(evidence.name);
  const city = normalizeCity(evidence.city);
  const address = normalizeAddress(evidence.address);
  const addressPrefix = normalizeAddressPrefix(evidence.address);
  const phone = normalizePhone(evidence.phone);
  const domains = [evidence.website, evidence.booking, evidence.instagram, evidence.sourceUrl]
    .map((value) => normalizeDomain(value))
    .filter(Boolean);
  const instagramHandle = normalizeInstagramHandle(evidence.instagram);
  const bookingKey = normalizeBookingKey(evidence.booking);
  const parentContainerId = parentContainerIdFromEvidence(evidence);
  const prefix = namePrefix(evidence.name);

  return {
    tier1: [
      phone ? `phone:${phone}` : "",
      ...domains.map((value) => `domain:${value}`),
      instagramHandle ? `instagram:${instagramHandle}` : "",
      bookingKey ? `booking:${bookingKey}` : "",
      name && city ? `name_city:${name}|${city}` : "",
      parentContainerId && name ? `parent_name:${parentContainerId}|${name}` : "",
    ].filter(Boolean),
    tier2: [
      address && city ? `address_city:${address}|${city}` : "",
      name ? `name:${name}` : "",
      address ? `address:${address}` : "",
      parentContainerId ? `parent:${parentContainerId}` : "",
    ].filter(Boolean),
    tier3: [
      prefix && city ? `city_prefix:${city}|${prefix}` : "",
      addressPrefix && city ? `addr_prefix_city:${addressPrefix}|${city}` : "",
      city ? `city:${city}` : "",
    ].filter(Boolean),
  };
}

function addKeys(map: Map<string, Set<string>>, operatorId: string, keys: string[]): void {
  for (const key of keys) {
    if (!key) continue;
    const bucket = map.get(key) || new Set<string>();
    bucket.add(operatorId);
    map.set(key, bucket);
  }
}

function collectTierCandidates(
  map: Map<string, Set<string>>,
  keys: string[],
  operatorsById: Map<string, ResolverOperator>,
  seenIds?: Set<string>
): ResolverOperator[] {
  const ids = new Set<string>();
  for (const key of keys) {
    const bucket = map.get(key);
    if (!bucket) continue;
    for (const id of bucket) {
      if (seenIds?.has(id)) continue;
      ids.add(id);
    }
  }
  return [...ids].map((id) => operatorsById.get(id)).filter((row): row is ResolverOperator => Boolean(row));
}

export function buildCanonicalCandidateIndex(initialOperators: ResolverOperator[]): CanonicalCandidateIndex {
  const operatorsById = new Map<string, ResolverOperator>();
  const exactIndex = new Map<string, Set<string>>();
  const mediumIndex = new Map<string, Set<string>>();
  const fallbackIndex = new Map<string, Set<string>>();

  const addOperator = (operator: ResolverOperator): void => {
    operatorsById.set(operator.id, operator);
    const keys = operatorKeys(operator);
    addKeys(exactIndex, operator.id, keys.tier1);
    addKeys(mediumIndex, operator.id, keys.tier2);
    addKeys(fallbackIndex, operator.id, keys.tier3);
  };

  const addEvidence = (operator: ResolverOperator, evidence: EvidenceRecord): void => {
    operatorsById.set(operator.id, operator);
    const keys = evidenceKeys(evidence);
    addKeys(exactIndex, operator.id, keys.tier1);
    addKeys(mediumIndex, operator.id, keys.tier2);
    addKeys(fallbackIndex, operator.id, keys.tier3);
  };

  for (const operator of initialOperators) addOperator(operator);

  return {
    addOperator,
    addEvidence,
    getCandidatesForEvidence: (evidence, opts) => {
      const keys = evidenceKeys(evidence);
      const tier1Candidates = collectTierCandidates(exactIndex, keys.tier1, operatorsById);
      const tier1Seen = new Set(tier1Candidates.map((row) => row.id));
      const tier2Candidates = collectTierCandidates(mediumIndex, keys.tier2, operatorsById, tier1Seen);
      const tier2Seen = new Set([...tier1Seen, ...tier2Candidates.map((row) => row.id)]);
      const tier3Candidates = collectTierCandidates(fallbackIndex, keys.tier3, operatorsById, tier2Seen);
      const globalFallbackCandidates =
        opts?.allowGlobalFallback === true && tier1Candidates.length + tier2Candidates.length + tier3Candidates.length === 0
          ? [...operatorsById.values()]
          : [];

      return {
        tier1Candidates,
        tier2Candidates,
        tier3Candidates,
        globalFallbackCandidates,
        candidateSetSize: tier1Candidates.length + tier2Candidates.length + tier3Candidates.length + globalFallbackCandidates.length,
        candidateLookupCount: keys.tier1.length + keys.tier2.length + keys.tier3.length,
        usedGlobalFallback: globalFallbackCandidates.length > 0,
      };
    },
  };
}
