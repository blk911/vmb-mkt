import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { loadResolverRegistry, saveResolverRegistry } from "./registry-store";
import { buildPromotionQueries } from "./promotion-queries";
import { scorePromotionCandidate } from "./promotion-score";
import type { PromotionResult, PromotionSummary } from "./promotion-types";
import type { SourceRecord } from "@/lib/operators/types";
import { runResolver } from "./run-resolver";
import { writePromotionAudit } from "./promotion-audit";

const PROMOTION_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/promotion_summary.json");
const PROMOTION_ATTEMPTS_PATH = path.join(process.cwd(), "runtime-data/promotion_attempts.json");
const PROMOTION_SCAN_ARTIFACT = "runtime-data/promotion_acquisition_scan.json";

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

  const candidateMap = new Map<string, { operator: (typeof before)[number]; score: number; reasons: string[] }>();
  for (const operator of before) {
    if (operator.status !== "enumerated") continue;
    const scored = scorePromotionCandidate(operator);
    if (scored.score <= 0) continue;
    const existing = candidateMap.get(operator.id);
    if (!existing || scored.score > existing.score) {
      candidateMap.set(operator.id, {
        operator,
        score: scored.score,
        reasons: scored.reasons,
      });
    }
  }
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score).slice(0, batchLimit);

  const promotionCandidates: SourceRecord[] = [];
  const evidenceByOperator = new Map<string, { count: number; sourceMix: Record<string, number> }>();
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
        promotionCandidates.push({
          source: "google",
          sourceUrl: url,
          name: hit.title,
          city: candidate.operator.canonicalCity,
          category: candidate.operator.category,
          address: candidate.operator.canonicalAddress,
          phone: candidate.operator.canonicalPhone,
          website: candidate.operator.canonicalWebsite,
          booking: candidate.operator.canonicalBooking,
          instagram: candidate.operator.canonicalInstagram,
          parentContainerName: candidate.operator.sources.find((x) => x.source === "container")?.name,
          childQuerySeeds: undefined,
          raw: {
            from: "promotion",
            operatorId: candidate.operator.id,
            query,
            snippet: hit.snippet,
          },
          extracted: {
            promotion: true,
            operatorId: candidate.operator.id,
            query,
          },
        });
      }
    }
  }

  const acquisition = await runAcquisition(promotionCandidates, { artifactPath: PROMOTION_SCAN_ARTIFACT });
  const extractedStrongRecords = acquisition.enrichedRecords.filter((record) => {
    const hasDirectSurface = Boolean(record.booking || record.instagram || record.website);
    if (!hasDirectSurface) return false;
    if (record.evidenceType === "directory_listing" && !record.booking && !record.instagram) return false;
    return true;
  });

  const evidenceRows = sourceRecordsToEvidence(extractedStrongRecords);
  for (const row of evidenceRows) {
    const operatorId =
      row.raw && typeof row.raw === "object" && "operatorId" in (row.raw as Record<string, unknown>)
        ? String((row.raw as Record<string, unknown>).operatorId || "")
        : "";
    if (!operatorId) continue;
    const current = evidenceByOperator.get(operatorId) || { count: 0, sourceMix: {} };
    current.count += 1;
    current.sourceMix[row.source] = (current.sourceMix[row.source] || 0) + 1;
    evidenceByOperator.set(operatorId, current);
  }
  for (const candidate of candidates) {
    const meta = attemptedMeta.get(candidate.operator.id);
    if (meta) meta.addedEvidenceCount = evidenceByOperator.get(candidate.operator.id)?.count || 0;
  }

  appendEvidence(evidenceRows);
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
    evidenceAdded: evidenceRows.length,
    extractedEvidenceAdded: evidenceRows.length,
    operatorsWithNewBooking: results.filter((x) => {
      const pre = beforeMap.get(x.operatorId);
      const post = afterMap.get(x.operatorId);
      return Boolean(!pre?.canonicalBooking && post?.canonicalBooking);
    }).length,
    operatorsWithNewInstagram: results.filter((x) => {
      const pre = beforeMap.get(x.operatorId);
      const post = afterMap.get(x.operatorId);
      return Boolean(!pre?.canonicalInstagram && post?.canonicalInstagram);
    }).length,
    operatorsWithNewWebsite: results.filter((x) => {
      const pre = beforeMap.get(x.operatorId);
      const post = afterMap.get(x.operatorId);
      return Boolean(!pre?.canonicalWebsite && post?.canonicalWebsite);
    }).length,
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
  writePromotionAudit({
    attempts: results,
    beforeMap,
    afterMap,
    evidenceByOperator,
  });

  writeJson(PROMOTION_SUMMARY_PATH, { generatedAt: new Date().toISOString(), ...summary });
  writeJson(PROMOTION_ATTEMPTS_PATH, {
    generatedAt: new Date().toISOString(),
    batchLimit,
    attempts: results,
  });

  return { summary, results };
}

