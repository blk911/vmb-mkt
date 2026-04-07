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

  const opInstagram = normalizeName((operator.canonicalInstagram || "").split("/").filter(Boolean).pop());
  const evInstagram = normalizeName((evidence.instagram || "").split("/").filter(Boolean).pop());
  if (opInstagram && evInstagram && opInstagram === evInstagram) score += 20;

  const opBooking = normalizeDomain(operator.canonicalBooking);
  const evBooking = normalizeDomain(evidence.booking);
  if (opBooking && evBooking && opBooking === evBooking) score += 10;

  if ((operator.canonicalCity || "").toLowerCase() && (evidence.city || "").toLowerCase()) {
    if (operator.canonicalCity?.toLowerCase() === evidence.city?.toLowerCase()) score += 10;
  }

  return score;
}

export function evaluateEvidenceMatch(
  operator: ResolverOperator,
  evidence: EvidenceRecord
): { score: number; matched: boolean } {
  const score = scoreEvidenceMatch(operator, evidence);
  let matched = false;
  if (hasPhoneAnchor(operator, evidence)) matched = score >= 40;
  else if (hasDomainAnchor(operator, evidence)) matched = score >= 45;
  else matched = score >= 70;
  return { score, matched };
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
  return evaluateEvidenceMatch(operator, evidence).matched;
}

