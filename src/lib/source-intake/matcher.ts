import { loadOperatorsFromResolverRegistry } from "@/lib/operators/loadOperators";
import type { OperatorConsoleRow } from "@/lib/operators/loadOperators";
import type { CandidateMatchSuggestion, ParsedCandidateRow, SourceIntakeRecord } from "./types";

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(input: string): string {
  return normalizeToken(input);
}

function firstInitial(name?: string): string {
  return normalizeName(name || "").slice(0, 1);
}

function splitName(input: string): { first?: string; last?: string; tokens: string[] } {
  const tokens = normalizeName(input).split(" ").filter(Boolean);
  return {
    first: tokens[0],
    last: tokens.length > 1 ? tokens[tokens.length - 1] : undefined,
    tokens,
  };
}

export function safeIncludes(a?: string, b?: string): boolean {
  const left = normalizeToken(a || "");
  const right = normalizeToken(b || "");
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

export function scoreNameMatch(a: string, b: string): number {
  const left = splitName(a);
  const right = splitName(b);
  const leftNorm = left.tokens.join(" ");
  const rightNorm = right.tokens.join(" ");
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 100;
  if (left.first && left.last && left.first === right.first && left.last === right.last) return 96;
  if (left.last && right.last && left.last === right.last && firstInitial(left.first) && firstInitial(left.first) === firstInitial(right.first)) {
    return 84;
  }

  const leftSet = new Set(left.tokens);
  const rightSet = new Set(right.tokens);
  const shared = [...leftSet].filter((token) => rightSet.has(token));
  if (!shared.length) return 0;

  const overlap = shared.length / Math.max(leftSet.size, rightSet.size);
  if (overlap >= 1) return 88;
  if (overlap >= 0.75) return 80;
  if (overlap >= 0.5) return 72;
  return 48;
}

function normalizeDomain(value?: string): string | undefined {
  const raw = (value || "").trim();
  if (!raw) return undefined;
  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() || undefined;
  }
}

function operatorDomains(operator: OperatorConsoleRow): Set<string> {
  const out = new Set<string>();
  const sourceRows = Object.values(operator.sources || {});
  const evidenceRows = operator.evidence || [];
  const candidates = [
    operator.canonical?.website,
    operator.canonical?.booking,
    ...sourceRows.flatMap((row) => [row?.sourceUrl, row?.website, row?.booking, row?.instagram]),
    ...evidenceRows.flatMap((row) => [row?.sourceUrl, row?.website, row?.booking, row?.instagram]),
  ];
  for (const value of candidates) {
    const domain = normalizeDomain(value);
    if (domain) out.add(domain);
  }
  return out;
}

type RankedCandidate = {
  operator: OperatorConsoleRow;
  score: number;
  reasons: string[];
  matchedFacilityId?: string;
};

function rankOperator(
  intake: SourceIntakeRecord,
  candidate: ParsedCandidateRow,
  operator: OperatorConsoleRow
): RankedCandidate {
  const reasons: string[] = [];
  const nameScore = scoreNameMatch(candidate.displayName, operator.name);
  let score = Math.round(nameScore * 0.65);

  if (nameScore === 100) reasons.push("exact normalized display name match");
  else if (nameScore >= 96) reasons.push("exact first and last name match");
  else if (nameScore >= 84) reasons.push("last name exact with first-initial alignment");
  else if (nameScore >= 72) reasons.push("strong token overlap on operator name");

  const intakeFacilityId = (intake.facilityId || "").trim();
  const operatorFacilityId = operator.parentContainerId || "";
  if (intakeFacilityId && operatorFacilityId && intakeFacilityId === operatorFacilityId) {
    score += 18;
    reasons.push("same anchored facilityId");
  }

  if (intake.facilityName && safeIncludes(intake.facilityName, operator.parentContainerName)) {
    score += 14;
    reasons.push("same facility name cluster");
  }

  if (intake.city && safeIncludes(intake.city, operator.city)) {
    score += 10;
    reasons.push("same city");
  }
  const intakeDomain = normalizeDomain(intake.sourceUrl) || normalizeDomain(intake.sourceLabel);
  if (intakeDomain && operatorDomains(operator).has(intakeDomain)) {
    score += 12;
    reasons.push("same website or booking domain cluster");
  }

  if (intake.sourceLabel && safeIncludes(intake.sourceLabel, operator.parentContainerName)) {
    score += 6;
    reasons.push("source label aligns with facility context");
  }

  if (candidate.roleLabel && operator.normalizedCategory) {
    const role = candidate.roleLabel.toLowerCase();
    const category = operator.normalizedCategory.toLowerCase();
    if ((role.includes("barber") && category === "hair") || (role.includes("stylist") && category === "hair")) {
      score += 4;
      reasons.push("role aligns with existing category");
    }
  }

  return {
    operator,
    score: Math.min(100, score),
    reasons,
    matchedFacilityId: operator.parentContainerId,
  };
}

function buildSuggestion(ranked: RankedCandidate[]): CandidateMatchSuggestion {
  const [top, second] = ranked;
  if (!top) {
    return {
      disposition: "new_candidate",
      score: 0,
      reasons: ["no plausible operator match found"],
    };
  }

  const ambiguous = Boolean(second && top.score >= 70 && second.score >= 70 && Math.abs(top.score - second.score) <= 4);
  if (ambiguous) {
    return {
      disposition: "held",
      matchedOperatorId: top.operator.id,
      matchedOperatorName: top.operator.name,
      matchedFacilityId: top.matchedFacilityId,
      score: top.score,
      reasons: [...top.reasons, "multiple close operator candidates"],
    };
  }

  if (top.score >= 90) {
    return {
      disposition: "matched",
      matchedOperatorId: top.operator.id,
      matchedOperatorName: top.operator.name,
      matchedFacilityId: top.matchedFacilityId,
      score: top.score,
      reasons: top.reasons,
    };
  }

  if (top.score >= 70) {
    return {
      disposition: "possible_match",
      matchedOperatorId: top.operator.id,
      matchedOperatorName: top.operator.name,
      matchedFacilityId: top.matchedFacilityId,
      score: top.score,
      reasons: top.reasons,
    };
  }

  return {
    disposition: "new_candidate",
    score: top.score,
    reasons: top.reasons.length ? top.reasons : ["name similarity too weak for safe match"],
  };
}

export async function buildCandidateMatchSuggestions(
  intake: SourceIntakeRecord,
  candidates: ParsedCandidateRow[]
): Promise<ParsedCandidateRow[]> {
  const operators = loadOperatorsFromResolverRegistry().filter((row) => !row.isContainer);

  return candidates.map((candidate) => {
    const ranked = operators
      .map((operator) => rankOperator(intake, candidate, operator))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      ...candidate,
      suggestedMatch: buildSuggestion(ranked),
      reviewAction: candidate.reviewAction ?? "pending",
    };
  });
}
