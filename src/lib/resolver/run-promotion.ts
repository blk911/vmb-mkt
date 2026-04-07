import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { classifyPage } from "@/lib/operators/page-classifier";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { loadResolverRegistry, saveResolverRegistry } from "./registry-store";
import { buildPromotionQueries } from "./promotion-queries";
import { scorePromotionCandidate } from "./promotion-score";
import type { PromotionResult, PromotionSummary } from "./promotion-types";
import { runResolver } from "./run-resolver";

const PROMOTION_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/promotion_summary.json");
const PROMOTION_ATTEMPTS_PATH = path.join(process.cwd(), "runtime-data/promotion_attempts.json");

function evidenceTypeFromPageType(type: ReturnType<typeof classifyPage>): EvidenceRecord["evidenceType"] | undefined {
  if (type === "direct_operator") return "direct_operator";
  if (type === "directory_listing") return "directory_listing";
  if (type === "suite_container") return "suite_container";
  if (type === "social_profile") return "social_profile";
  return undefined;
}

function sourceFromPageType(type: ReturnType<typeof classifyPage>): EvidenceRecord["source"] {
  if (type === "suite_container") return "container";
  if (type === "directory_listing") return "directory";
  if (type === "social_profile") return "instagram";
  if (type === "website") return "website";
  return "google";
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function runPromotion(opts?: { batchLimit?: number }): Promise<{
  summary: PromotionSummary;
  results: PromotionResult[];
}> {
  const batchLimit = Math.max(1, Math.min(200, opts?.batchLimit ?? 50));
  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((x) => [x.id, x]));

  const candidates = before
    .filter((x) => x.status === "enumerated")
    .map((operator) => {
      const scored = scorePromotionCandidate(operator);
      return { operator, score: scored.score, reasons: scored.reasons };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, batchLimit);

  const promotionEvidence: EvidenceRecord[] = [];
  const attemptedMeta = new Map<string, { reasons: string[]; queriesRun: string[]; addedEvidenceCount: number }>();

  for (const candidate of candidates) {
    const queries = buildPromotionQueries(candidate.operator);
    const meta = { reasons: candidate.reasons, queriesRun: queries, addedEvidenceCount: 0 };
    attemptedMeta.set(candidate.operator.id, meta);
    for (const query of queries) {
      const hits = await runGoogleSearch(query, 4);
      for (const hit of hits) {
        const url = hit.link || "";
        if (!url.startsWith("http")) continue;
        const pageType = classifyPage(url);
        promotionEvidence.push({
          id: `${candidate.operator.id}-${Date.now()}-${promotionEvidence.length}`,
          source: sourceFromPageType(pageType),
          sourceUrl: url,
          name: hit.title,
          city: candidate.operator.canonicalCity,
          address: candidate.operator.canonicalAddress,
          phone: candidate.operator.canonicalPhone,
          website: pageType === "website" ? url : undefined,
          parentContainerName: candidate.operator.sources.find((x) => x.source === "container")?.name,
          evidenceType: evidenceTypeFromPageType(pageType),
          raw: {
            from: "promotion",
            operatorId: candidate.operator.id,
            query,
            snippet: hit.snippet,
          },
          createdAt: Date.now(),
        });
        meta.addedEvidenceCount += 1;
      }
    }
  }

  appendEvidence(promotionEvidence);
  const after = runResolver();
  const afterMap = new Map(after.map((x) => [x.id, x]));

  const results: PromotionResult[] = candidates.map((candidate) => {
    const previous = beforeMap.get(candidate.operator.id) || candidate.operator;
    const next = afterMap.get(candidate.operator.id) || previous;
    const meta = attemptedMeta.get(candidate.operator.id) || { reasons: [], queriesRun: [], addedEvidenceCount: 0 };
    const changed = previous.status !== next.status;
    return {
      operatorId: candidate.operator.id,
      addedEvidenceCount: meta.addedEvidenceCount,
      previousStatus: previous.status,
      nextStatus: next.status,
      reasons: meta.reasons,
      queriesRun: meta.queriesRun,
      changed,
    };
  });

  const summary: PromotionSummary = {
    attemptedOperators: results.length,
    evidenceAdded: promotionEvidence.length,
    promotedToEnriched: results.filter((x) => x.previousStatus === "enumerated" && x.nextStatus === "enriched").length,
    promotedToHot: results.filter((x) => x.previousStatus === "enumerated" && x.nextStatus === "hot").length,
    unchanged: results.filter((x) => x.previousStatus === x.nextStatus).length,
  };

  const scoredMap = new Map(candidates.map((x) => [x.operator.id, x]));
  const afterWithPromotion = after.map((op) => {
    const scored = scoredMap.get(op.id);
    if (!scored) return op;
    const result = results.find((r) => r.operatorId === op.id);
    const state: NonNullable<typeof op.promotionState> =
      result?.nextStatus === "hot"
        ? "promoted_hot"
        : result?.nextStatus === "enriched"
          ? "promoted_enriched"
          : "unchanged";
    return {
      ...op,
      promotionScore: scored.score,
      promotionReasons: scored.reasons,
      promotionState: state,
    };
  });
  saveResolverRegistry(afterWithPromotion);

  writeJson(PROMOTION_SUMMARY_PATH, { generatedAt: new Date().toISOString(), ...summary });
  writeJson(PROMOTION_ATTEMPTS_PATH, {
    generatedAt: new Date().toISOString(),
    batchLimit,
    attempts: results,
  });

  return { summary, results };
}

