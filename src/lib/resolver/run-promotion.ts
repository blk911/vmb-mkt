import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { loadResolverRegistry, saveResolverRegistry } from "./registry-store";
import { buildPromotionQueries } from "./promotion-queries";
import { scorePromotionCandidate } from "./promotion-score";
import type { PromotionResult, PromotionSummary } from "./promotion-types";
import type { SourceRecord } from "@/lib/operators/types";
import { runResolver } from "./run-resolver";
import { writePromotionAudit } from "./promotion-audit";
import { classifyPromotionLane, type PromotionLane } from "./promotion-lanes";
import { traverseDirectoryForOperator } from "./directory-traversal";
import { liftTenantsFromContainer } from "./tenant-lift";
import { evaluateTenantPromotionOutcome } from "./tenant-promotion";

const PROMOTION_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/promotion_summary.json");
const PROMOTION_ATTEMPTS_PATH = path.join(process.cwd(), "runtime-data/promotion_attempts.json");
const PROMOTION_SCAN_ARTIFACT = "runtime-data/promotion_acquisition_scan.json";
const PROMOTION_LANE_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/promotion_lane_summary.json");

const LANES: PromotionLane[] = ["website_backed", "directory_backed", "container_adjacent", "identity_only"];

type PromotionCandidateRow = {
  operator: ReturnType<typeof loadResolverRegistry>[number];
  score: number;
  reasons: string[];
  lane: PromotionLane;
};

type PromotionMethod = "google_search" | "directory_traversal" | "tenant_lift";

function zeroLaneMap(): Record<PromotionLane, number> {
  return {
    website_backed: 0,
    directory_backed: 0,
    container_adjacent: 0,
    identity_only: 0,
  };
}

function laneQuota(batchLimit: number): Record<PromotionLane, number> {
  const quota = zeroLaneMap();
  quota.website_backed = Math.floor(batchLimit * 0.4);
  quota.directory_backed = Math.floor(batchLimit * 0.4);
  quota.container_adjacent = Math.floor(batchLimit * 0.2);
  quota.identity_only = Math.max(0, Math.min(10, batchLimit - (quota.website_backed + quota.directory_backed + quota.container_adjacent)));
  return quota;
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function candidateToPromotionRecord(
  candidate: PromotionCandidateRow,
  url: string,
  method: PromotionMethod,
  query?: string,
  snippet?: string
): SourceRecord {
  const source: SourceRecord["source"] =
    method === "directory_traversal" ? "directory" : method === "tenant_lift" ? "container" : "google";
  return {
    source,
    sourceUrl: url,
    name: candidate.operator.canonicalName,
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
      promotionMethod: method,
      operatorId: candidate.operator.id,
      query,
      snippet,
    },
    extracted: {
      promotion: true,
      operatorId: candidate.operator.id,
      promotionMethod: method,
      query,
    },
  };
}

async function addGoogleFallbackCandidates(
  candidate: PromotionCandidateRow,
  promotionCandidates: SourceRecord[]
): Promise<string[]> {
  const queries = buildPromotionQueries(candidate.operator);
  for (const query of queries) {
    const hits = await runGoogleSearch(query, 4);
    for (const hit of hits) {
      const url = hit.link || "";
      if (!url.startsWith("http")) continue;
      promotionCandidates.push(candidateToPromotionRecord(candidate, url, "google_search", query, hit.snippet));
    }
  }
  return queries;
}

export async function runPromotion(opts?: { batchLimit?: number }): Promise<{
  summary: PromotionSummary;
  results: PromotionResult[];
}> {
  const batchLimit = Math.max(1, Math.min(200, opts?.batchLimit ?? 50));
  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((x) => [x.id, x]));

  const candidateMap = new Map<string, PromotionCandidateRow>();
  const enumeratedLaneCounts = zeroLaneMap();
  for (const operator of before) {
    if (operator.status !== "enumerated") continue;
    const lane = classifyPromotionLane(operator);
    enumeratedLaneCounts[lane] += 1;
    const scored = scorePromotionCandidate(operator);
    if (scored.score <= 0) continue;
    const existing = candidateMap.get(operator.id);
    if (!existing || scored.score > existing.score) {
      candidateMap.set(operator.id, {
        operator,
        score: scored.score,
        reasons: scored.reasons,
        lane,
      });
    }
  }
  const byLane = new Map<PromotionLane, PromotionCandidateRow[]>();
  for (const lane of LANES) byLane.set(lane, []);
  for (const candidate of candidateMap.values()) {
    byLane.get(candidate.lane)?.push(candidate);
  }
  for (const lane of LANES) {
    byLane.get(lane)?.sort((a, b) => b.score - a.score);
  }

  const quotas = laneQuota(batchLimit);
  const selectedMap = new Map<string, PromotionCandidateRow>();
  for (const lane of LANES) {
    const rows = byLane.get(lane) || [];
    for (const candidate of rows.slice(0, quotas[lane])) {
      selectedMap.set(candidate.operator.id, candidate);
    }
  }
  if (selectedMap.size < batchLimit) {
    const leftovers = [...candidateMap.values()]
      .filter((candidate) => !selectedMap.has(candidate.operator.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, batchLimit - selectedMap.size);
    for (const candidate of leftovers) selectedMap.set(candidate.operator.id, candidate);
  }
  const candidates = [...selectedMap.values()].slice(0, batchLimit);
  const attemptedLaneCounts = zeroLaneMap();
  for (const candidate of candidates) attemptedLaneCounts[candidate.lane] += 1;

  const promotionCandidates: SourceRecord[] = [];
  const preAcquisitionEvidence: EvidenceRecord[] = [];
  const evidenceByOperator = new Map<string, { count: number; sourceMix: Record<string, number>; lane: PromotionLane }>();
  const attemptedMeta = new Map<
    string,
    {
      lane: PromotionLane;
      reasons: string[];
      queriesRun: string[];
      addedEvidenceCount: number;
      promotionMethod: PromotionMethod;
      yieldedDirectDetailPages: boolean;
    }
  >();

  for (const candidate of candidates) {
    const meta = {
      lane: candidate.lane,
      reasons: candidate.reasons,
      queriesRun: [] as string[],
      addedEvidenceCount: 0,
      promotionMethod: "google_search" as PromotionMethod,
      yieldedDirectDetailPages: false,
    };
    attemptedMeta.set(candidate.operator.id, meta);

    if (candidate.lane === "directory_backed") {
      const traversal = await traverseDirectoryForOperator(candidate.operator);
      meta.yieldedDirectDetailPages = traversal.yieldedDirectDetailPages;
      if (traversal.followOn.length) {
        meta.promotionMethod = "directory_traversal";
        meta.queriesRun = traversal.followOn.map((x) => x.url);
        for (const row of traversal.followOn) {
          promotionCandidates.push(
            candidateToPromotionRecord(candidate, row.url, "directory_traversal", `traverse:${row.fromUrl}`)
          );
        }
        continue;
      }
      meta.queriesRun = await addGoogleFallbackCandidates(candidate, promotionCandidates);
      continue;
    }

    if (candidate.lane === "container_adjacent") {
      const lifted = await liftTenantsFromContainer(candidate.operator);
      meta.yieldedDirectDetailPages = lifted.yieldedDirectDetailPages;
      if (lifted.tenantEvidence.length) {
        preAcquisitionEvidence.push(...lifted.tenantEvidence);
      }
      if (lifted.followOnUrls.length) {
        meta.promotionMethod = "tenant_lift";
        meta.queriesRun = lifted.followOnUrls;
        for (const detailUrl of lifted.followOnUrls) {
          promotionCandidates.push(candidateToPromotionRecord(candidate, detailUrl, "tenant_lift", "lifted_internal_link"));
        }
        continue;
      }
      meta.queriesRun = await addGoogleFallbackCandidates(candidate, promotionCandidates);
      continue;
    }

    meta.queriesRun = await addGoogleFallbackCandidates(candidate, promotionCandidates);
  }

  const acquisition = await runAcquisition(promotionCandidates, { artifactPath: PROMOTION_SCAN_ARTIFACT });
  const extractedStrongRecords = acquisition.enrichedRecords.filter((record) => {
    const hasDirectSurface = Boolean(record.booking || record.instagram || record.website);
    if (!hasDirectSurface) return false;
    if (record.evidenceType === "directory_listing" && !record.booking && !record.instagram) return false;
    return true;
  });

  const evidenceRows = [...preAcquisitionEvidence, ...sourceRecordsToEvidence(extractedStrongRecords)];
  for (const row of evidenceRows) {
    const operatorId =
      row.raw && typeof row.raw === "object" && "operatorId" in (row.raw as Record<string, unknown>)
        ? String((row.raw as Record<string, unknown>).operatorId || "")
        : "";
    if (!operatorId) continue;
    const current = evidenceByOperator.get(operatorId) || {
      count: 0,
      sourceMix: {},
      lane: attemptedMeta.get(operatorId)?.lane || "identity_only",
    };
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
    const meta = attemptedMeta.get(candidate.operator.id) || {
      lane: candidate.lane,
      reasons: [],
      queriesRun: [],
      addedEvidenceCount: 0,
      promotionMethod: "google_search" as PromotionMethod,
      yieldedDirectDetailPages: false,
    };
    const changed = previous.status !== next.status;
    const childOutcome = evaluateTenantPromotionOutcome({
      parentOperatorId: candidate.operator.id,
      beforeMap,
      afterMap,
    });
    return {
      operatorId: candidate.operator.id,
      promotionLane: meta.lane,
      promotionMethod: meta.promotionMethod,
      yieldedDirectDetailPages: meta.yieldedDirectDetailPages,
      childOperatorsCreated: childOutcome.childOperatorsCreated,
      childOperatorsPromotedEnriched: childOutcome.childOperatorsPromotedEnriched,
      childOperatorsPromotedHot: childOutcome.childOperatorsPromotedHot,
      childPromotionOutcome: childOutcome.childPromotionOutcome,
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
    childOperatorsCreated: results.reduce((sum, row) => sum + (row.childOperatorsCreated || 0), 0),
    childOperatorsPromotedEnriched: results.reduce((sum, row) => sum + (row.childOperatorsPromotedEnriched || 0), 0),
    childOperatorsPromotedHot: results.reduce((sum, row) => sum + (row.childOperatorsPromotedHot || 0), 0),
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
  const laneEvidenceAdded = zeroLaneMap();
  for (const evidence of evidenceByOperator.values()) {
    laneEvidenceAdded[evidence.lane] += evidence.count;
  }
  const lanePromotedCounts = zeroLaneMap();
  for (const result of results) {
    if (!result.promotionLane) continue;
    if (result.previousStatus !== result.nextStatus && (result.nextStatus === "enriched" || result.nextStatus === "hot")) {
      lanePromotedCounts[result.promotionLane] += 1;
    }
  }

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
      promotionLane: scored.lane,
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
  writeJson(PROMOTION_LANE_SUMMARY_PATH, {
    generatedAt: new Date().toISOString(),
    batchLimit,
    laneCountsEnumeratedPool: enumeratedLaneCounts,
    laneCountsAttempted: attemptedLaneCounts,
    laneEvidenceAdded,
    lanePromotedCounts,
  });

  return { summary, results };
}

