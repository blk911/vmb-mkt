import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { loadEvidence } from "@/lib/evidence/store";
import { expandContainerEvidence } from "./container-expansion";
import { buildCanonicalCandidateIndex } from "./canonical-candidate-index";
import { evaluateEvidenceMatch } from "./match";
import { normalizeAddress, normalizeCity, normalizeDomain, normalizeName, normalizePhone } from "./normalize";
import { loadResolverRegistry, saveResolverRegistry, saveResolverSummary } from "./registry-store";
import type { ResolverOperator } from "./types";
import { loadOperatorReviews } from "@/lib/operators/review-store";
import { compactResolverOperators } from "./compaction";
import { RuntimeTraceLogger } from "./runtime-trace";

const RESOLVER_RUNTIME_TRACE_PATH = path.join(process.cwd(), "runtime-data/resolver_runtime_trace.jsonl");
const RESOLVER_RUNTIME_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/resolver_runtime_summary.json");

type ResolverRunOptions = {
  traceRuntime?: boolean;
  safeRuntime?: boolean;
  totalBudgetMs?: number;
  phaseBudgetMs?: number;
  heartbeatEvery?: number;
  persistOutputs?: boolean;
  allowGlobalCanonicalFallback?: boolean;
};

type ResolverRuntimeSummary = {
  generatedAt: string;
  status: "completed" | "timed_out" | "error";
  completed: boolean;
  timedOut: boolean;
  totalElapsedMs: number;
  dominantSlowPhase: string;
  phaseTimings: Record<string, number>;
  phaseCounts: Record<string, number>;
  phaseBudgetExceeded: string[];
  canonicalComparisonsPerformed: number;
  canonicalCandidateLookupsPerformed: number;
  canonicalCandidateSetAvg: number;
  canonicalCandidateSetMax: number;
  canonicalFullScansPerformed: number;
  canonicalNewOperatorsCreated: number;
  canonicalMatchedExistingOperators: number;
  errorPhase?: string;
  error?: string;
};

class ResolverPhaseTimeout extends Error {
  readonly phase: string;

  constructor(phase: string, message: string) {
    super(message);
    this.name = "ResolverPhaseTimeout";
    this.phase = phase;
  }
}

function writeResolverRuntimeSummary(summary: ResolverRuntimeSummary): void {
  fs.mkdirSync(path.dirname(RESOLVER_RUNTIME_SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(RESOLVER_RUNTIME_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

function buildResolverRuntimeTools(opts?: ResolverRunOptions): {
  enabled: boolean;
  traceLogger?: RuntimeTraceLogger;
  startedAt: number;
  phaseTimings: Map<string, number>;
  phaseCounts: Map<string, number>;
  phaseBudgetExceeded: Set<string>;
  heartbeatEvery: number;
  totalBudgetMs: number;
  phaseBudgetMs: number;
} {
  const enabled = opts?.traceRuntime === true || opts?.safeRuntime === true;
  return {
    enabled,
    traceLogger: enabled
      ? new RuntimeTraceLogger({
          outputPath: RESOLVER_RUNTIME_TRACE_PATH,
          slowStageThresholdMs: opts?.phaseBudgetMs ?? 5000,
        })
      : undefined,
    startedAt: Date.now(),
    phaseTimings: new Map<string, number>(),
    phaseCounts: new Map<string, number>(),
    phaseBudgetExceeded: new Set<string>(),
    heartbeatEvery: Math.max(25, opts?.heartbeatEvery ?? 250),
    totalBudgetMs: Math.max(1000, opts?.totalBudgetMs ?? 15000),
    phaseBudgetMs: Math.max(250, opts?.phaseBudgetMs ?? 5000),
  };
}

function recordPhaseCount(runtime: ReturnType<typeof buildResolverRuntimeTools>, phase: string, count: number): void {
  runtime.phaseCounts.set(phase, count);
}

function startPhase(
  runtime: ReturnType<typeof buildResolverRuntimeTools>,
  phase: string,
  note?: string
): number {
  runtime.traceLogger?.log({
    stage: phase,
    status: "start",
    note,
  });
  return Date.now();
}

function finishPhase(
  runtime: ReturnType<typeof buildResolverRuntimeTools>,
  phase: string,
  phaseStartedAt: number,
  count?: number,
  note?: string
): void {
  const elapsedMs = Date.now() - phaseStartedAt;
  runtime.phaseTimings.set(phase, elapsedMs);
  if (typeof count === "number") recordPhaseCount(runtime, phase, count);
  if (elapsedMs > runtime.phaseBudgetMs) runtime.phaseBudgetExceeded.add(phase);
  runtime.traceLogger?.log({
    stage: phase,
    status: "success",
    elapsedMs,
    note: note || (typeof count === "number" ? `count=${count}` : undefined),
  });
}

function heartbeat(
  runtime: ReturnType<typeof buildResolverRuntimeTools>,
  phase: string,
  processed: number,
  total: number,
  note?: string
): void {
  runtime.traceLogger?.log({
    stage: `${phase}_heartbeat`,
    status: "success",
    elapsedMs: Date.now() - runtime.startedAt,
    note: note || `processed=${processed}/${total}`,
  });
}

function checkResolverBudget(
  runtime: ReturnType<typeof buildResolverRuntimeTools>,
  phase: string,
  phaseStartedAt: number
): void {
  if (!runtime.enabled) return;
  if (Date.now() - runtime.startedAt > runtime.totalBudgetMs) {
    runtime.traceLogger?.log({
      stage: phase,
      status: "timeout",
      elapsedMs: Date.now() - phaseStartedAt,
      note: `resolverBudgetMs=${runtime.totalBudgetMs}`,
    });
    throw new ResolverPhaseTimeout(phase, `Resolver budget exceeded in ${phase}`);
  }
}

function operatorTypeFromEvidence(e: EvidenceRecord): "operator" | "container" | "child_operator" | undefined {
  const extractedType =
    e.extracted && typeof e.extracted === "object" && "operatorType" in (e.extracted as Record<string, unknown>)
      ? (e.extracted as Record<string, unknown>).operatorType
      : undefined;
  const rawType =
    e.raw && typeof e.raw === "object" && "operatorType" in (e.raw as Record<string, unknown>)
      ? (e.raw as Record<string, unknown>).operatorType
      : undefined;
  const value = (extractedType || rawType || "").toString();
  if (value === "container" || value === "child_operator" || value === "operator") return value;
  return undefined;
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

function operatorIdFromEvidence(e: EvidenceRecord): string {
  const key = [
    normalizeName(e.name),
    normalizeAddress(e.address),
    normalizePhone(e.phone),
    normalizeDomain(e.website || e.booking || e.instagram),
  ].join("|");
  return crypto.createHash("md5").update(key || `${e.id}`).digest("hex");
}

function normalizeEvidence(e: EvidenceRecord): EvidenceRecord {
  let derivedName = e.name?.trim() || e.name;
  const isTenantLift =
    e.raw && typeof e.raw === "object" && "promotionMethod" in (e.raw as Record<string, unknown>)
      ? (e.raw as Record<string, unknown>).promotionMethod === "tenant_lift"
      : false;
  if (!derivedName && isTenantLift && e.sourceUrl) {
    try {
      const parsed = new URL(e.sourceUrl);
      const last = parsed.pathname.split("/").filter(Boolean).pop() || "";
      const cleaned = last
        .replace(/[-_]+/g, " ")
        .replace(/\b(profile|provider|staff|member|artist|book|booking|detail|services?)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length >= 3) derivedName = cleaned;
    } catch {
      // ignore URL parse failures
    }
  }
  return {
    ...e,
    name: derivedName,
    address: e.address?.trim() || e.address,
    city: normalizeCity(e.city) || e.city,
    phone: normalizePhone(e.phone) || e.phone,
  };
}

function createOperatorFromEvidence(e: EvidenceRecord, now: number): ResolverOperator {
  const parentContainerId = parentContainerIdFromEvidence(e);
  const operatorType = operatorTypeFromEvidence(e);
  const isContainerEvidence = e.evidenceType === "suite_container" || e.source === "container";
  const isContainer = operatorType === "container" || (isContainerEvidence && !parentContainerId);
  return {
    id: operatorIdFromEvidence(e),
    operatorType: operatorType || (parentContainerId ? "child_operator" : isContainer ? "container" : "operator"),
    parentContainerName: e.parentContainerName,
    canonicalName: e.name,
    canonicalAddress: e.address,
    canonicalCity: e.city,
    canonicalPhone: e.phone,
    canonicalWebsite: e.website,
    canonicalInstagram: e.instagram,
    canonicalBooking: e.booking,
    category: inferCategory(e) || e.category,
    sources: [e],
    confidenceScore: 1,
    status: "enumerated",
    isContainer,
    parentContainerId,
    createdAt: now,
    updatedAt: now,
  };
}

function inferCategory(e: EvidenceRecord): string | undefined {
  const rawCategory =
    e.raw && typeof e.raw === "object" && "category" in (e.raw as Record<string, unknown>)
      ? String((e.raw as Record<string, unknown>).category || "")
      : "";
  const text = [e.name || "", rawCategory].join(" ").toLowerCase();
  if (text.includes("nail")) return "nails";
  if (text.includes("lash")) return "lashes";
  if (text.includes("brow")) return "brows";
  if (text.includes("hair")) return "hair";
  if (text.includes("spa")) return "spa";
  return undefined;
}

function deriveNormalizedCategory(op: ResolverOperator): ResolverOperator["normalizedCategory"] {
  const text = [op.category || "", op.canonicalName || ""].join(" ").toLowerCase();
  const hasNails = text.includes("nail");
  const hasLashes = text.includes("lash");
  const hasBrows = text.includes("brow");
  const hasHair = text.includes("hair") || text.includes("barber");
  const hasSpa = text.includes("spa") || text.includes("esthetic");
  const hits = [hasNails, hasLashes, hasBrows, hasHair, hasSpa].filter(Boolean).length;
  if (hits > 1) return "multi_service";
  if (hasNails) return "nails";
  if (hasLashes) return "lashes";
  if (hasBrows) return "brows";
  if (hasHair) return "hair";
  if (hasSpa) return "spa";
  return "unknown";
}

function derivePreferredContactSurface(op: ResolverOperator): ResolverOperator["preferredContactSurface"] {
  if (op.canonicalBooking) return "booking";
  if (op.canonicalInstagram) return "instagram";
  if (op.canonicalWebsite) return "website";
  if (op.canonicalPhone) return "phone";
  return "none";
}

function sourcePriority(source: EvidenceRecord["source"]): number {
  if (source === "booking") return 6;
  if (source === "website") return 5;
  if (source === "instagram") return 4;
  if (source === "directory") return 3;
  if (source === "google") return 2;
  if (source === "dora") return 2;
  if (source === "container") return 1;
  return 1;
}

function isProvisionalName(value?: string): boolean {
  const text = normalizeName(value);
  if (!text) return true;
  if (!text.includes(" ")) return true;
  if (/(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text)) return true;
  return false;
}

function evidenceStrength(row: EvidenceRecord): number {
  let score = sourcePriority(row.source) * 10;
  const fromSolaRecovery =
    row.raw && typeof row.raw === "object" && "from" in (row.raw as Record<string, unknown>)
      ? (row.raw as Record<string, unknown>).from === "sola_child_surface_recovery"
      : false;
  const fromDirectoryBackedPromotion =
    row.raw && typeof row.raw === "object" && "from" in (row.raw as Record<string, unknown>)
      ? (row.raw as Record<string, unknown>).from === "directory_backed_surface_promotion"
      : false;
  const deepExtractor =
    row.extracted && typeof row.extracted === "object" && "parserUsed" in (row.extracted as Record<string, unknown>)
      ? String((row.extracted as Record<string, unknown>).parserUsed || "")
      : "";
  const isSolaDeep = deepExtractor === "sola-deep";
  if (row.evidenceType === "direct_operator") score += 20;
  if (row.booking) score += 8;
  if (row.instagram) score += 6;
  if (row.website) score += 5;
  if (row.phone) score += 4;
  if (isSolaDeep) score += 16;
  if (fromSolaRecovery) score += 14;
  if (fromDirectoryBackedPromotion) score += 20;
  if (row.name && !isProvisionalName(row.name)) score += 6;
  return score;
}

function updateCanonical(op: ResolverOperator): void {
  const sorted = [...op.sources].sort((a, b) => evidenceStrength(b) - evidenceStrength(a));
  const pick = <K extends keyof EvidenceRecord>(field: K): EvidenceRecord[K] | undefined => sorted.find((x) => Boolean(x[field]))?.[field];
  const pickName = (): string | undefined => {
    const nonProvisional = sorted.find((x) => x.name && !isProvisionalName(x.name))?.name;
    return nonProvisional || sorted.find((x) => Boolean(x.name))?.name;
  };

  op.canonicalBooking = (pick("booking") as string | undefined) || op.canonicalBooking;
  op.canonicalWebsite = (pick("website") as string | undefined) || op.canonicalWebsite;
  op.canonicalInstagram = (pick("instagram") as string | undefined) || op.canonicalInstagram;
  op.canonicalPhone = (pick("phone") as string | undefined) || op.canonicalPhone;
  const upgradedName = pickName();
  if (upgradedName && (!op.canonicalName || isProvisionalName(op.canonicalName) || !isProvisionalName(upgradedName))) {
    op.canonicalName = upgradedName;
  }
  op.canonicalAddress = (pick("address") as string | undefined) || op.canonicalAddress;
  op.canonicalCity = (pick("city") as string | undefined) || op.canonicalCity;
  op.parentContainerName = (pick("parentContainerName") as string | undefined) || op.parentContainerName;
}

function shouldSkipParentContainerMerge(op: ResolverOperator, evidence: EvidenceRecord): boolean {
  const evidenceParentId = parentContainerIdFromEvidence(evidence);
  if (!evidenceParentId) return false;
  if (!op.isContainer) return false;
  if (op.id === evidenceParentId) return true;
  if (op.parentContainerId && op.parentContainerId === evidenceParentId) return true;
  return false;
}

function scoreOperator(op: ResolverOperator): number {
  if (op.isContainer) return 0;
  let score = 0;
  if (op.canonicalBooking) score += 5;
  if (op.canonicalInstagram) score += 4;
  if (op.canonicalWebsite) score += 3;
  if (op.canonicalPhone) score += 2;
  score += Math.min(8, op.sources.length);
  return score;
}

function assignStatus(op: ResolverOperator): ResolverOperator["status"] {
  if (op.isContainer) return "shelved";
  const hasBooking = Boolean(op.canonicalBooking);
  const hasStrongIG = Boolean(op.canonicalInstagram && op.canonicalName && op.canonicalCity);
  const isChildOperator = Boolean(op.parentContainerId && !op.isContainer);
  const hasPromotionDirectEvidence = op.sources.some((row) => {
    const fromPromotion =
      row.raw && typeof row.raw === "object" && "from" in (row.raw as Record<string, unknown>)
        ? (row.raw as Record<string, unknown>).from === "promotion"
        : false;
    if (!fromPromotion) return false;
    return Boolean(row.booking || row.instagram || row.website);
  });
  const hasSolaRecoveryDirectEvidence = op.sources.some((row) => {
    const fromSola =
      row.raw && typeof row.raw === "object" && "from" in (row.raw as Record<string, unknown>)
        ? (row.raw as Record<string, unknown>).from === "sola_child_surface_recovery"
        : false;
    if (!fromSola) return false;
    return Boolean(row.booking || row.instagram || row.website || row.phone);
  });
  const hasDirectoryBackedPromotionDirectEvidence = op.sources.some((row) => {
    const fromDirectoryBacked =
      row.raw && typeof row.raw === "object" && "from" in (row.raw as Record<string, unknown>)
        ? (row.raw as Record<string, unknown>).from === "directory_backed_surface_promotion"
        : false;
    if (!fromDirectoryBacked) return false;
    return Boolean(row.booking || row.instagram || row.website || row.phone);
  });
  if (hasBooking || hasStrongIG) return "hot";
  if (hasPromotionDirectEvidence && op.canonicalBooking) return "hot";
  if (hasPromotionDirectEvidence && op.canonicalInstagram && op.canonicalName && op.canonicalCity) return "hot";
  if (hasPromotionDirectEvidence && isChildOperator && op.canonicalBooking) return "hot";
  if (hasDirectoryBackedPromotionDirectEvidence && (op.canonicalBooking || hasStrongIG)) return "hot";
  if (hasSolaRecoveryDirectEvidence && isChildOperator && (op.canonicalBooking || op.canonicalInstagram)) return "hot";
  const hasIdentity = Boolean(op.canonicalName && (op.canonicalCity || op.canonicalAddress));
  if (hasIdentity && (op.canonicalWebsite || op.canonicalPhone || op.sources.length >= 3)) return "enriched";
  if (hasPromotionDirectEvidence && hasIdentity && op.canonicalWebsite) return "enriched";
  if (hasPromotionDirectEvidence && isChildOperator && (op.canonicalWebsite || op.canonicalInstagram || op.sources.length >= 2)) {
    return "enriched";
  }
  if (hasDirectoryBackedPromotionDirectEvidence && hasIdentity && (op.canonicalWebsite || op.canonicalInstagram || op.canonicalPhone)) {
    return "enriched";
  }
  if (hasSolaRecoveryDirectEvidence && isChildOperator && (op.canonicalWebsite || op.canonicalPhone || op.sources.length >= 2)) {
    return "enriched";
  }
  return "enumerated";
}

function overlayReviews(operators: ResolverOperator[]): ResolverOperator[] {
  const reviews = loadOperatorReviews();
  const map = new Map(reviews.map((x) => [x.operatorId, x]));
  return operators.map((op) => {
    const row = map.get(op.id);
    if (!row) return { ...op, reviewState: op.reviewState ?? "unreviewed" };
    return {
      ...op,
      reviewState: row.reviewState,
      reviewNotes: row.reviewNotes,
    };
  });
}

function overlayPromotionFields(operators: ResolverOperator[]): ResolverOperator[] {
  const previous = loadResolverRegistry();
  const map = new Map(previous.map((x) => [x.id, x]));
  return operators.map((op) => {
    const prior = map.get(op.id);
    if (!prior) return { ...op, promotionState: op.promotionState ?? "untried" };
    return {
      ...op,
      promotionScore: op.promotionScore ?? prior.promotionScore,
      promotionReasons: op.promotionReasons ?? prior.promotionReasons,
      promotionLane: op.promotionLane ?? prior.promotionLane,
      promotionState: op.promotionState ?? prior.promotionState ?? "untried",
    };
  });
}

export function runResolverFromEvidence(inputEvidence?: EvidenceRecord[], opts?: ResolverRunOptions): ResolverOperator[] {
  const now = Date.now();
  const runtime = buildResolverRuntimeTools(opts);
  const phaseCounts: Record<string, number> = {};
  let errorPhase: string | undefined;
  let errorMessage: string | undefined;
  let timedOut = false;
  let result: ResolverOperator[] = [];
  let canonicalComparisonsPerformed = 0;
  let canonicalCandidateLookupsPerformed = 0;
  let canonicalCandidateSetTotal = 0;
  let canonicalCandidateSetMax = 0;
  let canonicalFullScansPerformed = 0;
  let canonicalNewOperatorsCreated = 0;
  let canonicalMatchedExistingOperators = 0;

  runtime.traceLogger?.log({
    stage: "resolver_start",
    status: "start",
    note: `safeRuntime=${opts?.safeRuntime === true}`,
  });

  try {
    const inputLoadStartedAt = startPhase(runtime, "input_load");
    const rawEvidence = inputEvidence || loadEvidence();
    finishPhase(runtime, "input_load", inputLoadStartedAt, rawEvidence.length);
    phaseCounts.input_load = rawEvidence.length;

    const evidencePrepStartedAt = startPhase(runtime, "evidence_indexing");
    const evidence = expandContainerEvidence(rawEvidence.map(normalizeEvidence));
    finishPhase(runtime, "evidence_indexing", evidencePrepStartedAt, evidence.length);
    phaseCounts.evidence_indexing = evidence.length;

    const operators: ResolverOperator[] = [];
    const canonicalIndex = buildCanonicalCandidateIndex(operators);
    let evidenceComparisons = 0;
    let candidateLookupsPerformed = 0;
    let candidateSetTotal = 0;
    let candidateSetMax = 0;
    let fullScansPerformed = 0;
    let newCanonicalsCreated = 0;
    let matchedExistingOperators = 0;
    const canonicalResolutionStartedAt = startPhase(runtime, "canonical_resolution", `evidence=${evidence.length}`);
    for (let i = 0; i < evidence.length; i += 1) {
      const row = evidence[i];
      const lookup = canonicalIndex.getCandidatesForEvidence(row, {
        allowGlobalFallback: opts?.allowGlobalCanonicalFallback === true,
      });
      candidateLookupsPerformed += 1;
      candidateSetTotal += lookup.candidateSetSize;
      candidateSetMax = Math.max(candidateSetMax, lookup.candidateSetSize);
      if (lookup.usedGlobalFallback) fullScansPerformed += 1;
      canonicalCandidateLookupsPerformed = candidateLookupsPerformed;
      canonicalCandidateSetTotal = candidateSetTotal;
      canonicalCandidateSetMax = candidateSetMax;
      canonicalFullScansPerformed = fullScansPerformed;
      let bestMatch: ResolverOperator | undefined;
      let bestScore = -1;
      let bestMatched = false;

      const seenCandidateIds = new Set<string>();
      const evaluateCandidates = (candidateOps: ResolverOperator[]) => {
        for (const op of candidateOps) {
          if (seenCandidateIds.has(op.id)) continue;
          seenCandidateIds.add(op.id);
          if (shouldSkipParentContainerMerge(op, row)) continue;
          const evaluation = evaluateEvidenceMatch(op, row);
          evidenceComparisons += 1;
          canonicalComparisonsPerformed = evidenceComparisons;
          if (runtime.enabled && evidenceComparisons % 10000 === 0) {
            runtime.phaseTimings.set("canonical_resolution", Date.now() - canonicalResolutionStartedAt);
            phaseCounts.canonical_resolution = evidenceComparisons;
            checkResolverBudget(runtime, "canonical_resolution", canonicalResolutionStartedAt);
          }
          if (evaluation.score > bestScore) {
            bestScore = evaluation.score;
            bestMatch = op;
            bestMatched = evaluation.matched;
          }
        }
      };

      evaluateCandidates(lookup.tier1Candidates);
      if (!bestMatched) evaluateCandidates(lookup.tier2Candidates);
      if (!bestMatched) evaluateCandidates(lookup.tier3Candidates);
      if (!bestMatched && lookup.globalFallbackCandidates.length > 0) {
        evaluateCandidates(lookup.globalFallbackCandidates);
      }

      if (bestMatch && bestMatched) {
        bestMatch.sources.push(row);
        if (!bestMatch.parentContainerId) bestMatch.parentContainerId = parentContainerIdFromEvidence(row);
        if (!bestMatch.parentContainerName && row.parentContainerName) bestMatch.parentContainerName = row.parentContainerName;
        if (!bestMatch.operatorType) bestMatch.operatorType = operatorTypeFromEvidence(row);
        bestMatch.confidenceScore = Math.max(bestMatch.confidenceScore, Math.floor(bestScore / 10));
        bestMatch.updatedAt = now;
        canonicalIndex.addEvidence(bestMatch, row);
        matchedExistingOperators += 1;
        canonicalMatchedExistingOperators = matchedExistingOperators;
      } else {
        const created = createOperatorFromEvidence(row, now);
        operators.push(created);
        canonicalIndex.addOperator(created);
        newCanonicalsCreated += 1;
        canonicalNewOperatorsCreated = newCanonicalsCreated;
      }

      if ((i + 1) % runtime.heartbeatEvery === 0 || i === evidence.length - 1) {
        runtime.phaseTimings.set("canonical_resolution", Date.now() - canonicalResolutionStartedAt);
        phaseCounts.canonical_resolution = evidenceComparisons;
        heartbeat(
          runtime,
          "canonical_resolution",
          i + 1,
          evidence.length,
          `operators=${operators.length}; comparisons=${evidenceComparisons}; candidateAvg=${candidateLookupsPerformed ? (candidateSetTotal / candidateLookupsPerformed).toFixed(2) : "0.00"}; candidateMax=${candidateSetMax}; fullScans=${fullScansPerformed}`
        );
        checkResolverBudget(runtime, "canonical_resolution", canonicalResolutionStartedAt);
      }
    }
    finishPhase(
      runtime,
      "canonical_resolution",
      canonicalResolutionStartedAt,
      evidenceComparisons,
      `operators=${operators.length}; candidateAvg=${candidateLookupsPerformed ? (candidateSetTotal / candidateLookupsPerformed).toFixed(2) : "0.00"}; candidateMax=${candidateSetMax}; fullScans=${fullScansPerformed}`
    );
    phaseCounts.canonical_resolution = evidenceComparisons;
    canonicalComparisonsPerformed = evidenceComparisons;
    canonicalCandidateLookupsPerformed = candidateLookupsPerformed;
    canonicalCandidateSetTotal = candidateSetTotal;
    canonicalCandidateSetMax = candidateSetMax;
    canonicalFullScansPerformed = fullScansPerformed;
    canonicalNewOperatorsCreated = newCanonicalsCreated;
    canonicalMatchedExistingOperators = matchedExistingOperators;

    const scoringPreStartedAt = startPhase(runtime, "status_scoring_pre_compaction", `operators=${operators.length}`);
    for (let i = 0; i < operators.length; i += 1) {
      const op = operators[i];
      op.operatorType = op.operatorType || (op.isContainer ? "container" : op.parentContainerId ? "child_operator" : "operator");
      updateCanonical(op);
      op.confidenceScore = Math.max(op.confidenceScore, scoreOperator(op));
      op.normalizedCategory = deriveNormalizedCategory(op);
      op.preferredContactSurface = derivePreferredContactSurface(op);
      op.status = assignStatus(op);
      op.updatedAt = now;
      if ((i + 1) % runtime.heartbeatEvery === 0 || i === operators.length - 1) {
        heartbeat(runtime, "status_scoring_pre_compaction", i + 1, operators.length);
        checkResolverBudget(runtime, "status_scoring_pre_compaction", scoringPreStartedAt);
      }
    }
    finishPhase(runtime, "status_scoring_pre_compaction", scoringPreStartedAt, operators.length);
    phaseCounts.status_scoring_pre_compaction = operators.length;

    const duplicateMergeStartedAt = startPhase(runtime, "duplicate_merge_pass", `operators=${operators.length}`);
    const compacted = compactResolverOperators(operators);
    finishPhase(
      runtime,
      "duplicate_merge_pass",
      duplicateMergeStartedAt,
      compacted.summary.compactedDuplicateCount,
      `post=${compacted.summary.postCompactionOperatorCount}`
    );
    phaseCounts.duplicate_merge_pass = compacted.summary.compactedDuplicateCount;

    const scoringPostStartedAt = startPhase(runtime, "status_scoring_post_compaction", `operators=${compacted.operators.length}`);
    for (let i = 0; i < compacted.operators.length; i += 1) {
      const op = compacted.operators[i];
      op.operatorType = op.operatorType || (op.isContainer ? "container" : op.parentContainerId ? "child_operator" : "operator");
      updateCanonical(op);
      op.confidenceScore = Math.max(op.confidenceScore, scoreOperator(op));
      op.normalizedCategory = deriveNormalizedCategory(op);
      op.preferredContactSurface = derivePreferredContactSurface(op);
      op.status = assignStatus(op);
      op.updatedAt = now;
      if ((i + 1) % runtime.heartbeatEvery === 0 || i === compacted.operators.length - 1) {
        heartbeat(runtime, "status_scoring_post_compaction", i + 1, compacted.operators.length);
        checkResolverBudget(runtime, "status_scoring_post_compaction", scoringPostStartedAt);
      }
    }
    finishPhase(runtime, "status_scoring_post_compaction", scoringPostStartedAt, compacted.operators.length);
    phaseCounts.status_scoring_post_compaction = compacted.operators.length;

    const childPassStartedAt = startPhase(runtime, "child_operator_pass");
    const childLinkedCount = compacted.operators.filter((op) => Boolean(op.parentContainerId)).length;
    finishPhase(runtime, "child_operator_pass", childPassStartedAt, childLinkedCount);
    phaseCounts.child_operator_pass = childLinkedCount;

    const reviewPhaseStartedAt = startPhase(runtime, "promotion_evaluation", `operators=${compacted.operators.length}`);
    const withReviews = overlayReviews(compacted.operators).map((op) => {
      if (op.reviewState === "ready") return { ...op, status: "ready" as const };
      if (op.reviewState === "shelved_by_review") return { ...op, status: "shelved" as const };
      return op;
    });
    const withPromotion = overlayPromotionFields(withReviews);
    finishPhase(runtime, "promotion_evaluation", reviewPhaseStartedAt, withPromotion.length);
    phaseCounts.promotion_evaluation = withPromotion.length;

    if (opts?.persistOutputs !== false) {
      const registryWriteStartedAt = startPhase(runtime, "output_materialization", `operators=${withPromotion.length}`);
      saveResolverRegistry(withPromotion);
      finishPhase(runtime, "output_materialization", registryWriteStartedAt, withPromotion.length);
      phaseCounts.output_materialization = withPromotion.length;

      const summaryWriteStartedAt = startPhase(runtime, "file_writes");
      saveResolverSummary({
        evidenceCount: rawEvidence.length,
        operators: withPromotion,
        preCompactionOperatorCount: compacted.summary.preCompactionOperatorCount,
        postCompactionOperatorCount: compacted.summary.postCompactionOperatorCount,
        compactedDuplicateCount: compacted.summary.compactedDuplicateCount,
      });
      finishPhase(runtime, "file_writes", summaryWriteStartedAt, 2);
      phaseCounts.file_writes = 2;
    } else {
      const summaryWriteStartedAt = startPhase(runtime, "file_writes");
      finishPhase(runtime, "file_writes", summaryWriteStartedAt, 0, "persistOutputs=false");
      phaseCounts.file_writes = 0;
    }

    result = withPromotion;
  } catch (error: unknown) {
    if (error instanceof ResolverPhaseTimeout) {
      timedOut = true;
      errorPhase = error.phase;
      errorMessage = error.message;
    } else {
      errorPhase = "unknown";
      errorMessage = error instanceof Error ? error.message : "unknown_resolver_error";
    }
    runtime.traceLogger?.log({
      stage: errorPhase || "resolver_error",
      status: timedOut ? "timeout" : "error",
      elapsedMs: Date.now() - runtime.startedAt,
      note: errorMessage,
    });
  }

  const dominantSlowPhase =
    (timedOut && errorPhase) ||
    [...runtime.phaseTimings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    errorPhase ||
    "none";
  const summary: ResolverRuntimeSummary = {
    generatedAt: new Date().toISOString(),
    status: timedOut ? "timed_out" : errorMessage ? "error" : "completed",
    completed: !timedOut && !errorMessage,
    timedOut,
    totalElapsedMs: Date.now() - runtime.startedAt,
    dominantSlowPhase,
    phaseTimings: Object.fromEntries(runtime.phaseTimings.entries()),
    phaseCounts,
    phaseBudgetExceeded: [...runtime.phaseBudgetExceeded.values()],
    canonicalComparisonsPerformed,
    canonicalCandidateLookupsPerformed,
    canonicalCandidateSetAvg: canonicalCandidateLookupsPerformed
      ? Number((canonicalCandidateSetTotal / canonicalCandidateLookupsPerformed).toFixed(2))
      : 0,
    canonicalCandidateSetMax,
    canonicalFullScansPerformed,
    canonicalNewOperatorsCreated,
    canonicalMatchedExistingOperators,
    errorPhase,
    error: errorMessage,
  };
  writeResolverRuntimeSummary(summary);
  runtime.traceLogger?.log({
    stage: "resolver_complete",
    status: timedOut ? "timeout" : errorMessage ? "error" : "success",
    elapsedMs: summary.totalElapsedMs,
    note: `dominantSlowPhase=${dominantSlowPhase}`,
  });
  return result;
}

export function runResolver(opts?: ResolverRunOptions): ResolverOperator[] {
  return runResolverFromEvidence(undefined, opts);
}

