import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import type { SourceRecord } from "@/lib/operators/types";
import { runGoogleSearch, type GoogleSearchResultMeta } from "@/lib/social-targets/operator-harvest/query-executor";
import { buildDirectoryBackedSurfacePromotionQueries } from "./promotion-queries";
import { writePromotionLaneComparisonSummary } from "./promotion-lane-comparison";
import { loadResolverRegistry } from "./registry-store";
import { RuntimeTraceLogger } from "./runtime-trace";
import { runResolverWithTimeout } from "./run-resolver-bounded";
import { selectDirectoryBackedPromotionCandidates } from "./directory-backed-promotion-selector";
import type { ResolverOperator } from "./types";

const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/directory_backed_surface_promotion_summary.json");
const ACQUISITION_ARTIFACT_PATH = "runtime-data/directory_backed_surface_promotion_acquisition_scan.json";

export type DirectoryBackedSurfacePromotionSummary = {
  generatedAt: string;
  runId: string;
  candidateCount: number;
  candidateThreshold: number;
  candidateHardAnchorCount: number;
  queriesGenerated: number;
  queriesExecuted: number;
  searchHitsSeen: number;
  acceptedEvidenceCount: number;
  acceptedDirectSurfaceCount: number;
  acceptedSupportingDetailCount: number;
  candidateTimeouts: number;
  fetchTimeouts: number;
  fetchErrors: number;
  queriesWithNoUsableHits: number;
  candidatesPartiallyProcessed: number;
  candidatesCompleted: number;
  upgradedWithInstagram: number;
  upgradedWithBooking: number;
  upgradedWithWebsite: number;
  promotedToEnriched: number;
  promotedToHot: number;
  rejectedWeakHits: number;
  rejectedAmbiguousHits: number;
  skippedAlreadyEnriched: number;
  skippedSolaOnly: number;
  skippedCanonicalConflict: number;
  skippedMergedAway: number;
  dominantSlowStage: string;
  slowStageCounts: Record<string, number>;
  topNearMisses: Array<{
    operatorId: string;
    name?: string;
    score: number;
    hardAnchors: string[];
    missingSurfaces: string[];
    reasonsRejected: string[];
  }>;
  topPromotions: Array<{
    operatorId: string;
    name?: string;
    beforeStatus: string;
    afterStatus: string;
    evidenceGained: PromotionEvidenceGain;
  }>;
};

type PromotionEvidenceGain = {
  instagram: boolean;
  booking: boolean;
  website: boolean;
};

function inferSourceFromUrl(url: string): SourceRecord["source"] {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (/(booksy|vagaro|glossgenius|styleseat|fresha|square\.site|squareup)/.test(lower)) return "booking";
  if (/(yelp|yellowpages|foursquare|mapquest|google\.)/.test(lower)) return "directory";
  return "website";
}

function toCandidateRecord(input: {
  operator: ResolverOperator;
  url: string;
  query: string;
  snippet?: string;
  strength: number;
  searchMeta?: GoogleSearchResultMeta;
}): SourceRecord {
  return {
    source: inferSourceFromUrl(input.url),
    operatorType: input.operator.operatorType || "operator",
    sourceUrl: input.url,
    name: input.operator.canonicalName,
    city: input.operator.canonicalCity,
    address: input.operator.canonicalAddress,
    phone: input.operator.canonicalPhone,
    website: input.operator.canonicalWebsite,
    booking: input.operator.canonicalBooking,
    instagram: input.operator.canonicalInstagram,
    category: input.operator.category,
    parentContainerId: input.operator.parentContainerId,
    parentContainerName: input.operator.parentContainerName,
    evidenceType: "direct_operator",
    raw: {
      from: "directory_backed_surface_promotion",
      operatorId: input.operator.id,
      query: input.query,
      snippet: input.snippet,
      candidateStrength: input.strength,
      searchMeta: input.searchMeta,
      createdAt: Date.now(),
    },
    extracted: {
      promotionMethod: "directory_backed_surface_promotion",
      operatorId: input.operator.id,
      operatorType: input.operator.operatorType || "operator",
      parentContainerId: input.operator.parentContainerId,
      query: input.query,
      searchMeta: input.searchMeta,
    },
  };
}

function isAcceptedEvidence(
  record: SourceRecord,
  baseline?: ResolverOperator
): {
  accepted: boolean;
  kind?: "direct_surface" | "supporting_detail";
  weak: boolean;
  ambiguous: boolean;
} {
  const hasDirectSurface = Boolean(record.booking || record.instagram || record.website);
  if (hasDirectSurface) {
    return { accepted: true, kind: "direct_surface", weak: false, ambiguous: false };
  }

  const sameCity = Boolean(record.city && baseline?.canonicalCity && record.city === baseline.canonicalCity);
  const samePhone = Boolean(record.phone && baseline?.canonicalPhone && record.phone === baseline.canonicalPhone);
  const recordName = record.name?.trim().toLowerCase();
  const baselineName = baseline?.canonicalName?.trim().toLowerCase();
  const sameName = Boolean(recordName && baselineName && recordName === baselineName);
  const corroboratingIdentity =
    Boolean(record.source === "directory" && (samePhone || (sameCity && sameName))) ||
    Boolean(record.phone && (record.address || record.city) && record.name && sameCity);
  if (corroboratingIdentity) {
    return { accepted: true, kind: "supporting_detail", weak: false, ambiguous: false };
  }

  const ambiguousIdentity = Boolean(record.name || record.city || record.address || record.phone);
  return { accepted: false, weak: !ambiguousIdentity, ambiguous: ambiguousIdentity };
}

function writeSummary(data: DirectoryBackedSurfacePromotionSummary): void {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

function writeAcquisitionArtifact(scanRows: unknown[], totalCandidates: number): void {
  const fullPath = path.join(process.cwd(), ACQUISITION_ARTIFACT_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(
    fullPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalCandidates,
        scannedPages: scanRows.length,
        scans: scanRows,
      },
      null,
      2
    )}\n`
  );
}

function normalizeCandidateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url.trim();
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hasExceededBudget(startedAt: number, budgetMs: number): boolean {
  return Date.now() - startedAt >= budgetMs;
}

export async function runDirectoryBackedSurfacePromotion(opts?: {
  limit?: number;
  maxQueriesPerOperator?: number;
  maxHitsPerQuery?: number;
  maxAcquisitionCandidatesPerOperator?: number;
  candidateBudgetMs?: number;
  fetchTimeoutMs?: number;
  resolverTimeoutMs?: number;
  safeRuntime?: boolean;
}): Promise<DirectoryBackedSurfacePromotionSummary> {
  const limit = Math.max(1, Math.min(120, opts?.limit ?? 60));
  const maxQueriesPerOperator = Math.max(1, Math.min(6, opts?.maxQueriesPerOperator ?? 6));
  const maxHitsPerQuery = Math.max(1, Math.min(5, opts?.maxHitsPerQuery ?? 3));
  const maxAcquisitionCandidatesPerOperator = Math.max(1, Math.min(12, opts?.maxAcquisitionCandidatesPerOperator ?? 8));
  const candidateBudgetMs = Math.max(5000, Math.min(60000, opts?.candidateBudgetMs ?? 25000));
  const fetchTimeoutMs = Math.max(2000, Math.min(12000, opts?.fetchTimeoutMs ?? 8000));
  const resolverTimeoutMs = Math.max(2000, Math.min(60000, opts?.resolverTimeoutMs ?? 15000));
  const safeRuntime = opts?.safeRuntime !== false;
  const traceLogger = new RuntimeTraceLogger();

  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((x) => [x.id, x]));
  const selection = selectDirectoryBackedPromotionCandidates(before, { limit });

  let queriesGenerated = 0;
  let queriesExecuted = 0;
  let searchHitsSeen = 0;
  let rejectedWeakHits = 0;
  let rejectedAmbiguousHits = 0;
  let candidateTimeouts = 0;
  let fetchTimeouts = 0;
  let fetchErrors = 0;
  let queriesWithNoUsableHits = 0;
  let candidatesPartiallyProcessed = 0;
  let candidatesCompleted = 0;

  const queryCandidates: SourceRecord[] = [];
  const acquisitionScanRows: unknown[] = [];
  for (const candidate of selection.candidates) {
    const candidateStartedAt = Date.now();
    let candidateTimedOut = false;
    let candidateHadTimeoutOrError = false;
    let candidateAcceptedRecords = 0;
    const candidateQueryCandidates: SourceRecord[] = [];
    const seenUrls = new Set<string>();
    const seenDomains = new Set<string>();

    traceLogger.log({
      operatorId: candidate.operator.id,
      operatorName: candidate.operator.canonicalName,
      stage: "candidate_selected",
      status: "success",
      candidateStrength: candidate.score,
      note: candidate.reasons.join("; "),
      intent: "directory_backed_surface_promotion",
    });

    const queries = buildDirectoryBackedSurfacePromotionQueries(candidate.operator, { maxQueries: maxQueriesPerOperator });
    queriesGenerated += queries.length;
    traceLogger.log({
      operatorId: candidate.operator.id,
      operatorName: candidate.operator.canonicalName,
      stage: "queries_built",
      status: "success",
      candidateStrength: candidate.score,
      intent: "directory_backed_surface_promotion",
      note: `count=${queries.length}`,
    });

    for (const query of queries) {
      if (safeRuntime && hasExceededBudget(candidateStartedAt, candidateBudgetMs)) {
        candidateTimedOut = true;
        traceLogger.log({
          operatorId: candidate.operator.id,
          operatorName: candidate.operator.canonicalName,
          query,
          stage: "candidate_budget",
          status: "timeout",
          elapsedMs: Date.now() - candidateStartedAt,
          candidateStrength: candidate.score,
          intent: "directory_backed_surface_promotion",
          note: `candidateBudgetMs=${candidateBudgetMs}`,
        });
        break;
      }
      queriesExecuted += 1;
      const hits = await runGoogleSearch(query, maxHitsPerQuery, {
        strictQuery: true,
        intent: "directory_backed_surface_promotion",
        operatorId: candidate.operator.id,
        operatorName: candidate.operator.canonicalName,
        candidateStrength: candidate.score,
        traceLogger,
      });
      searchHitsSeen += hits.length;
      let usableHits = 0;
      for (const hit of hits) {
        if (!hit.link || !hit.link.startsWith("http")) continue;
        const normalizedUrl = normalizeCandidateUrl(hit.link);
        const domain = hostFromUrl(normalizedUrl);
        if (seenUrls.has(normalizedUrl) || (domain && seenDomains.has(domain))) {
          traceLogger.log({
            operatorId: candidate.operator.id,
            operatorName: candidate.operator.canonicalName,
            query,
            stage: "acquisition_handoff",
            status: "skipped",
            url: normalizedUrl,
            candidateStrength: candidate.score,
            intent: "directory_backed_surface_promotion",
            note: "duplicate_url_or_domain",
          });
          continue;
        }
        seenUrls.add(normalizedUrl);
        if (domain) seenDomains.add(domain);
        usableHits += 1;
        candidateQueryCandidates.push(
          toCandidateRecord({
            operator: candidate.operator,
            url: normalizedUrl,
            query,
            snippet: hit.snippet,
            strength: candidate.score,
            searchMeta: hit.meta,
          })
        );
        traceLogger.log({
          operatorId: candidate.operator.id,
          operatorName: candidate.operator.canonicalName,
          query,
          stage: "acquisition_handoff",
          status: "success",
          url: normalizedUrl,
          candidateStrength: candidate.score,
          intent: "directory_backed_surface_promotion",
        });
        if (candidateQueryCandidates.length >= maxAcquisitionCandidatesPerOperator) break;
      }
      if (usableHits === 0) queriesWithNoUsableHits += 1;
      if (candidateQueryCandidates.length >= maxAcquisitionCandidatesPerOperator) break;
    }

    if (!candidateTimedOut && candidateQueryCandidates.length > 0) {
      traceLogger.log({
        operatorId: candidate.operator.id,
        operatorName: candidate.operator.canonicalName,
        stage: "acquisition_batch",
        status: "start",
        elapsedMs: Date.now() - candidateStartedAt,
        candidateStrength: candidate.score,
        intent: "directory_backed_surface_promotion",
        note: `records=${candidateQueryCandidates.length}`,
      });
      const remainingBudgetMs = Math.max(1000, candidateBudgetMs - (Date.now() - candidateStartedAt));
      const acquisition = await runAcquisition(candidateQueryCandidates, {
        artifactPath: ACQUISITION_ARTIFACT_PATH,
        writeArtifact: false,
        safeRuntime,
        fetchTimeoutMs,
        maxRuntimeMs: remainingBudgetMs,
        traceLogger,
      });
      acquisitionScanRows.push(...acquisition.scanRows);
      fetchTimeouts += acquisition.fetchTimeouts;
      fetchErrors += acquisition.fetchErrors;
      if (acquisition.fetchTimeouts > 0 || acquisition.fetchErrors > 0 || acquisition.budgetExceeded) {
        candidateHadTimeoutOrError = true;
      }
      if (acquisition.budgetExceeded) candidateTimedOut = true;

      for (const row of acquisition.enrichedRecords) {
        const operatorId =
          row.raw && typeof row.raw === "object" && "operatorId" in (row.raw as Record<string, unknown>)
            ? String((row.raw as Record<string, unknown>).operatorId || "")
            : "";
        const baseline = operatorId ? beforeMap.get(operatorId) : undefined;
        const decision = isAcceptedEvidence(row, baseline);
        if (decision.accepted) {
          queryCandidates.push(row);
          candidateAcceptedRecords += 1;
          traceLogger.log({
            operatorId: operatorId || candidate.operator.id,
            operatorName: candidate.operator.canonicalName,
            query:
              row.raw && typeof row.raw === "object" && "query" in (row.raw as Record<string, unknown>)
                ? String((row.raw as Record<string, unknown>).query || "")
                : undefined,
            stage: "acquisition_decision",
            status: "accepted",
            url: row.sourceUrl,
            candidateStrength: candidate.score,
            intent: "directory_backed_surface_promotion",
            note: decision.kind,
          });
        } else {
          traceLogger.log({
            operatorId: operatorId || candidate.operator.id,
            operatorName: candidate.operator.canonicalName,
            query:
              row.raw && typeof row.raw === "object" && "query" in (row.raw as Record<string, unknown>)
                ? String((row.raw as Record<string, unknown>).query || "")
                : undefined,
            stage: "acquisition_decision",
            status: decision.weak ? "skipped" : "rejected",
            url: row.sourceUrl,
            candidateStrength: candidate.score,
            intent: "directory_backed_surface_promotion",
            note: decision.weak ? "weak" : "ambiguous",
          });
          if (decision.weak) rejectedWeakHits += 1;
          if (decision.ambiguous) rejectedAmbiguousHits += 1;
        }
      }
    }

    if (candidateTimedOut) candidateTimeouts += 1;
    if (candidateTimedOut || candidateHadTimeoutOrError) {
      candidatesPartiallyProcessed += 1;
    } else {
      candidatesCompleted += 1;
    }
    traceLogger.log({
      operatorId: candidate.operator.id,
      operatorName: candidate.operator.canonicalName,
      stage: "candidate_complete",
      status: candidateTimedOut ? "timeout" : "success",
      elapsedMs: Date.now() - candidateStartedAt,
      candidateStrength: candidate.score,
      intent: "directory_backed_surface_promotion",
      note: `accepted=${candidateAcceptedRecords}`,
    });
  }

  const accepted: SourceRecord[] = [];
  let acceptedDirectSurfaceCount = 0;
  let acceptedSupportingDetailCount = 0;
  for (const row of queryCandidates) {
    const operatorId =
      row.raw && typeof row.raw === "object" && "operatorId" in (row.raw as Record<string, unknown>)
        ? String((row.raw as Record<string, unknown>).operatorId || "")
        : "";
    const baseline = operatorId ? beforeMap.get(operatorId) : undefined;
    const decision = isAcceptedEvidence(row, baseline);
    if (decision.accepted) {
      accepted.push(row);
      if (decision.kind === "direct_surface") acceptedDirectSurfaceCount += 1;
      if (decision.kind === "supporting_detail") acceptedSupportingDetailCount += 1;
    }
  }

  writeAcquisitionArtifact(acquisitionScanRows, selection.candidates.length);
  const evidenceRows = sourceRecordsToEvidence(accepted);
  appendEvidence(evidenceRows);
  traceLogger.log({
    stage: "resolver_rerun",
    status: "start",
    intent: "directory_backed_surface_promotion",
  });
  let after = before;
  const resolverStartedAt = Date.now();
  try {
    const resolverRun = runResolverWithTimeout({ timeoutMs: resolverTimeoutMs });
    after = resolverRun.operators;
    if (!resolverRun.completed) {
      traceLogger.log({
        stage: "resolver_rerun",
        status: resolverRun.timedOut ? "timeout" : "error",
        elapsedMs: Date.now() - resolverStartedAt,
        intent: "directory_backed_surface_promotion",
        note: resolverRun.error,
      });
    } else {
      traceLogger.log({
        stage: "resolver_rerun",
        status: "success",
        elapsedMs: Date.now() - resolverStartedAt,
        intent: "directory_backed_surface_promotion",
      });
    }
  } catch (error: unknown) {
    traceLogger.log({
      stage: "resolver_rerun",
      status: "error",
      elapsedMs: Date.now() - resolverStartedAt,
      intent: "directory_backed_surface_promotion",
      note: error instanceof Error ? error.message : "unknown_resolver_error",
    });
  }
  const afterMap = new Map(after.map((x) => [x.id, x]));

  let upgradedWithInstagram = 0;
  let upgradedWithBooking = 0;
  let upgradedWithWebsite = 0;
  let promotedToEnriched = 0;
  let promotedToHot = 0;
  const topPromotions: Array<{
    operatorId: string;
    name?: string;
    beforeStatus: string;
    afterStatus: string;
    evidenceGained: PromotionEvidenceGain;
  }> = [];

  for (const candidate of selection.candidates) {
    const pre = beforeMap.get(candidate.operator.id);
    const post = afterMap.get(candidate.operator.id);
    if (!pre || !post) continue;

    const evidenceGained: PromotionEvidenceGain = {
      instagram: Boolean(!pre.canonicalInstagram && post.canonicalInstagram),
      booking: Boolean(!pre.canonicalBooking && post.canonicalBooking),
      website: Boolean(!pre.canonicalWebsite && post.canonicalWebsite),
    };
    if (evidenceGained.instagram) upgradedWithInstagram += 1;
    if (evidenceGained.booking) upgradedWithBooking += 1;
    if (evidenceGained.website) upgradedWithWebsite += 1;

    if (pre.status !== "hot" && post.status === "hot") promotedToHot += 1;
    if ((pre.status === "enumerated" || pre.status === "shelved") && post.status === "enriched") promotedToEnriched += 1;

    if (
      pre.status !== post.status ||
      evidenceGained.instagram ||
      evidenceGained.booking ||
      evidenceGained.website
    ) {
      topPromotions.push({
        operatorId: candidate.operator.id,
        name: post.canonicalName || pre.canonicalName,
        beforeStatus: pre.status,
        afterStatus: post.status,
        evidenceGained,
      });
    }
  }

  const traceSummary = traceLogger.summary();
  const summary: DirectoryBackedSurfacePromotionSummary = {
    generatedAt: new Date().toISOString(),
    runId: traceLogger.runId,
    candidateCount: selection.candidates.length,
    candidateThreshold: selection.candidateThreshold,
    candidateHardAnchorCount: selection.candidateHardAnchorCount,
    queriesGenerated,
    queriesExecuted,
    searchHitsSeen,
    acceptedEvidenceCount: evidenceRows.length,
    acceptedDirectSurfaceCount,
    acceptedSupportingDetailCount,
    candidateTimeouts,
    fetchTimeouts,
    fetchErrors,
    queriesWithNoUsableHits,
    candidatesPartiallyProcessed,
    candidatesCompleted,
    upgradedWithInstagram,
    upgradedWithBooking,
    upgradedWithWebsite,
    promotedToEnriched,
    promotedToHot,
    rejectedWeakHits,
    rejectedAmbiguousHits,
    skippedAlreadyEnriched: selection.skippedAlreadyEnriched,
    skippedSolaOnly: selection.skippedSolaOnly,
    skippedCanonicalConflict: selection.skippedCanonicalConflict,
    skippedMergedAway: selection.skippedMergedAway,
    dominantSlowStage: traceSummary.dominantSlowStage,
    slowStageCounts: traceSummary.slowStageCounts,
    topNearMisses: selection.nearMisses.slice(0, 15).map((row) => ({
      operatorId: row.operatorId,
      name: row.name,
      score: row.score,
      hardAnchors: row.hardAnchors,
      missingSurfaces: row.missingSurfaces,
      reasonsRejected: row.reasonsRejected,
    })),
    topPromotions: topPromotions.slice(0, 25),
  };
  writeSummary(summary);
  writePromotionLaneComparisonSummary({
    directorySummary: summary,
    includeSolaDiagnostic: false,
  });
  return summary;
}

if (require.main === module) {
  runDirectoryBackedSurfacePromotion()
    .then((summary) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            summaryPath: "runtime-data/directory_backed_surface_promotion_summary.json",
            candidateCount: summary.candidateCount,
            promotedToEnriched: summary.promotedToEnriched,
            promotedToHot: summary.promotedToHot,
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}
