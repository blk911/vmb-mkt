import type { EvidenceRecord } from "@/lib/evidence/types";
import type { ResolverOperator } from "./types";
import { normalizeAddress, normalizeDomain, normalizeName, normalizePhone } from "./normalize";

function tokenSet(text: string): Set<string> {
  return new Set(text.split(" ").map((x) => x.trim()).filter(Boolean));
}

function jaccard(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const v of sa) if (sb.has(v)) intersection += 1;
  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 0;
}

export function scoreEvidenceMatch(operator: ResolverOperator, evidence: EvidenceRecord): number {
  let score = 0;

  const nameScore = jaccard(normalizeName(operator.canonicalName), normalizeName(evidence.name));
  score += Math.round(nameScore * 40);

  const addrScore = jaccard(normalizeAddress(operator.canonicalAddress), normalizeAddress(evidence.address));
  score += Math.round(addrScore * 25);

  const phoneA = normalizePhone(operator.canonicalPhone);
  const phoneB = normalizePhone(evidence.phone);
  if (phoneA && phoneB && phoneA === phoneB) score += 25;

  const domains = [
    normalizeDomain(operator.canonicalWebsite),
    normalizeDomain(operator.canonicalBooking),
    normalizeDomain(operator.canonicalInstagram),
  ].filter(Boolean);
  const evidenceDomains = [
    normalizeDomain(evidence.website),
    normalizeDomain(evidence.booking),
    normalizeDomain(evidence.instagram),
    normalizeDomain(evidence.sourceUrl),
  ].filter(Boolean);
  if (domains.some((a) => evidenceDomains.some((b) => a === b))) score += 20;

  if ((operator.canonicalCity || "").toLowerCase() && (evidence.city || "").toLowerCase()) {
    if (operator.canonicalCity?.toLowerCase() === evidence.city?.toLowerCase()) score += 10;
  }

  return score;
}

function hasPhoneAnchor(operator: ResolverOperator, evidence: EvidenceRecord): boolean {
  const phoneA = normalizePhone(operator.canonicalPhone);
  const phoneB = normalizePhone(evidence.phone);
  return Boolean(phoneA && phoneB && phoneA === phoneB);
}

function hasDomainAnchor(operator: ResolverOperator, evidence: EvidenceRecord): boolean {
  const domains = [
    normalizeDomain(operator.canonicalWebsite),
    normalizeDomain(operator.canonicalBooking),
    normalizeDomain(operator.canonicalInstagram),
  ].filter(Boolean);
  const evidenceDomains = [
    normalizeDomain(evidence.website),
    normalizeDomain(evidence.booking),
    normalizeDomain(evidence.instagram),
    normalizeDomain(evidence.sourceUrl),
  ].filter(Boolean);
  return domains.some((a) => evidenceDomains.some((b) => a === b));
}

export function isEvidenceMatch(operator: ResolverOperator, evidence: EvidenceRecord): boolean {
  const score = scoreEvidenceMatch(operator, evidence);
  if (hasPhoneAnchor(operator, evidence)) return score >= 40;
  if (hasDomainAnchor(operator, evidence)) return score >= 45;
  return score >= 70;
}

