import { loadResolverRegistryForUi } from "@/lib/resolver/registry-store";
import { getSourceIntakeById, listParsedCandidates } from "@/lib/source-intake/store";
import { listDoraQueue, listDoraResults, listSocialQueue, listSocialResults } from "@/lib/source-intake/phase2-store";
import type { ResolverOperator } from "@/lib/resolver/types";
import type { DoraValidationResult, SocialDiscoveryResult } from "@/lib/source-intake/phase2-types";
import { normalizeCanonicalCategory, toInstagramProfileUrl } from "@/lib/admin/pipeline/normalization";

export type CanonicalOperator = {
  id: string;
  name: string;
  city: string;
  ig?: string;
  status: "approved" | "rejected" | "merged";
  score: number;
  category?: string;
  validationConfidence?: number;
  followerCount?: number;
};

type ApprovedResult = DoraValidationResult | SocialDiscoveryResult;

function toResolverMap(): Map<string, ResolverOperator> {
  return new Map(loadResolverRegistryForUi().map((row) => [row.id, row]));
}

function computeOperatorScore(input: {
  hasInstagram: boolean;
  followerCount?: number;
  validationConfidence?: number;
  locationKnown: boolean;
}): number {
  let score = 0;
  if (input.hasInstagram) score += 30;
  if (typeof input.followerCount === "number") {
    score += Math.min(20, Math.round(input.followerCount / 250));
  }
  if (typeof input.validationConfidence === "number") {
    score += Math.min(40, Math.max(0, Math.round(input.validationConfidence * 0.4)));
  }
  if (input.locationKnown) score += 10;
  return Math.min(100, score);
}

function toResolverBackedCanonical(operator: ResolverOperator): CanonicalOperator | null {
  if (!operator.id || !operator.canonicalName) return null;
  return {
    id: operator.id,
    name: operator.canonicalName,
    city: operator.canonicalCity || "Unknown",
    ig: operator.canonicalInstagram,
    status: "approved",
    category: normalizeCanonicalCategory(operator.category || operator.normalizedCategory),
    validationConfidence: Number(operator.confidenceScore || 0),
    score: computeOperatorScore({
      hasInstagram: Boolean(operator.canonicalInstagram),
      validationConfidence: Number(operator.confidenceScore || 0),
      locationKnown: Boolean(operator.canonicalCity && operator.canonicalCity !== "Unknown"),
    }),
  };
}

function resultValidationConfidence(result: ApprovedResult): number {
  return "score" in result ? Number(result.score || 0) : 70;
}

export async function listCanonicalOperators(): Promise<CanonicalOperator[]> {
  const resolverById = toResolverMap();
  const [doraResults, socialResults, doraQueue, socialQueue] = await Promise.all([
    listDoraResults(),
    listSocialResults(),
    listDoraQueue(),
    listSocialQueue(),
  ]);

  const queueById = new Map([...doraQueue, ...socialQueue].map((row) => [row.id, row]));
  const approvedResults = [...doraResults, ...socialResults].filter((row) => row.finalStatus === "approved");
  const intakeIds = [...new Set(approvedResults.map((row) => row.intakeId))];
  const candidateByKey = new Map<string, Awaited<ReturnType<typeof listParsedCandidates>>[number]>();
  const intakeCityById = new Map<string, string>();

  await Promise.all(
    intakeIds.map(async (intakeId) => {
      const [candidates, intake] = await Promise.all([listParsedCandidates(intakeId), getSourceIntakeById(intakeId)]);
      for (const candidate of candidates) {
        candidateByKey.set(`${candidate.intakeId}:${candidate.id}`, candidate);
      }
      intakeCityById.set(intakeId, intake?.city || "Unknown");
    })
  );

  const rows = new Map<string, CanonicalOperator>();
  for (const result of approvedResults) {
    if (result.targetOperatorId && resolverById.has(result.targetOperatorId)) {
      const resolverRow = resolverById.get(result.targetOperatorId)!;
      const canonical = toResolverBackedCanonical(resolverRow);
      if (canonical) rows.set(canonical.id, canonical);
      continue;
    }

    const queueItem = queueById.get(result.queueItemId);
    const candidate = candidateByKey.get(`${result.intakeId}:${result.candidateId}`);
    const instagram =
      ("discoveredSurfaces" in result
        ? result.discoveredSurfaces.find((surface) => surface.type === "instagram")?.value
        : undefined) ||
      toInstagramProfileUrl(queueItem?.sourceUrl);
    const location = queueItem?.city || ("city" in result ? result.city : undefined) || intakeCityById.get(result.intakeId) || "Unknown";
    const score = computeOperatorScore({
      hasInstagram: Boolean(instagram),
      validationConfidence: resultValidationConfidence(result),
      locationKnown: Boolean(location && location !== "Unknown"),
    });

    rows.set(`approved:${result.intakeId}:${result.candidateId}`, {
      id: `approved:${result.intakeId}:${result.candidateId}`,
      name: candidate?.displayName || queueItem?.displayName || "Unnamed Approved Candidate",
      city: location,
      ig: instagram,
      status: "approved",
      category: normalizeCanonicalCategory(candidate?.roleLabel),
      validationConfidence: resultValidationConfidence(result),
      score,
    });
  }

  return [...rows.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
