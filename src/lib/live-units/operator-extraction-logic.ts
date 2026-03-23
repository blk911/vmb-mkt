/**
 * Ultra-strict surfacing: Tier A only for primary UI; medium/low stay internal.
 */
import { MOCK_OPERATOR_CANDIDATES_BY_BUSINESS } from "@/lib/mock/liveUnits/operatorCandidates";
import type {
  ExtractedOperatorCandidate,
  OperatorConfidence,
  OperatorSourceType,
  SurfacedOperator,
} from "./operator-extraction-types";

const ROLE_EVIDENCE = /stylist|esthetician|np\b|artist|provider|technician|owner|director|nail|cosmetolog|practitioner/i;

export function normalizeOperatorCandidate(c: ExtractedOperatorCandidate): ExtractedOperatorCandidate {
  return {
    ...c,
    operatorName: c.operatorName?.trim() || null,
    roleLabel: c.roleLabel?.trim() || null,
    instagramHandle: c.instagramHandle?.replace(/^@/, "").trim() || null,
    businessName: c.businessName?.trim() || null,
    locationLabel: c.locationLabel?.trim() || null,
    evidenceSnippets: c.evidenceSnippets.map((s) => s.trim()).filter(Boolean),
    sourceTypes: [...new Set(c.sourceTypes)] as OperatorSourceType[],
  };
}

function hasRoleContext(c: ExtractedOperatorCandidate): boolean {
  const blob = [...c.evidenceSnippets, c.roleLabel || "", c.operatorName || ""].join(" ");
  return ROLE_EVIDENCE.test(blob);
}

/**
 * Tier A surfacing rules (v1). Medium/low never pass.
 */
export function isHighConfidenceOperator(c: ExtractedOperatorCandidate): boolean {
  const n = normalizeOperatorCandidate(c);
  if (!n.businessId?.trim()) return false;
  if (n.confidence === "low" || n.confidence === "medium") return false;
  if (!n.operatorName?.trim()) return false;

  const sources = new Set(n.sourceTypes);
  const websiteStrong =
    sources.has("website_staff_page") || sources.has("website_provider_page");
  if (websiteStrong) {
    return true;
  }

  const igPostOrBio = sources.has("instagram_business_post") || sources.has("instagram_business_bio");
  const cross = sources.has("instagram_cross_link");
  if (igPostOrBio && hasRoleContext(n) && (cross || n.evidenceSnippets.length >= 2)) {
    return true;
  }

  if (cross && n.instagramHandle && hasRoleContext(n) && n.evidenceSnippets.length >= 1) {
    return true;
  }

  const trustedSignals = [
    websiteStrong,
    sources.has("instagram_business_post"),
    sources.has("instagram_cross_link"),
    sources.has("instagram_business_bio"),
  ].filter(Boolean).length;
  if (trustedSignals >= 2 && hasRoleContext(n)) {
    return true;
  }

  return false;
}

export function toSurfacedOperator(c: ExtractedOperatorCandidate): SurfacedOperator | null {
  if (!isHighConfidenceOperator(c)) return null;
  const n = normalizeOperatorCandidate(c);
  return {
    id: n.id,
    businessId: n.businessId,
    operatorName: n.operatorName!,
    roleLabel: n.roleLabel,
    instagramHandle: n.instagramHandle,
    profileUrl: n.profileUrl,
    sourceTypes: n.sourceTypes,
    evidenceSnippets: n.evidenceSnippets,
    confidence: "high",
    lastSeenAt: n.lastSeenAt,
  };
}

export function extractSurfacedOperatorsForBusiness(candidates: ExtractedOperatorCandidate[]): SurfacedOperator[] {
  const out: SurfacedOperator[] = [];
  for (const raw of candidates) {
    const s = toSurfacedOperator(raw);
    if (s) out.push(s);
  }
  return out;
}

export function getMockCandidatesForBusinessId(businessId: string): ExtractedOperatorCandidate[] {
  return MOCK_OPERATOR_CANDIDATES_BY_BUSINESS[businessId] ?? [];
}

export function getSurfacedOperatorsForBusinessId(businessId: string): SurfacedOperator[] {
  return extractSurfacedOperatorsForBusiness(getMockCandidatesForBusinessId(businessId));
}

export function getSurfacedOperatorCount(businessId: string): number {
  return getSurfacedOperatorsForBusinessId(businessId).length;
}

export function displayNameForOperator(o: SurfacedOperator): string {
  return o.operatorName;
}

/** Short line for entity summary when operators are attached. */
export function operatorAttachmentSuffix(surfacedCount: number): string {
  if (surfacedCount <= 0) return "";
  if (surfacedCount === 1) return " · 1 validated provider attached.";
  return ` · ${surfacedCount} validated providers attached.`;
}
