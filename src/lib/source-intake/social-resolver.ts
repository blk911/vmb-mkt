import { buildGoogleDiscoveryPack } from "@/lib/social-targets/google-discovery/query-generator";
import { nameSimilarityScore } from "@/lib/social-targets/evidence";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { detectPlatformFromUrl, extractHandle } from "@/lib/social-targets/social-normalization";
import { loadResolverRegistry } from "@/lib/resolver/registry-store";
import {
  findSocialResultByQueueItemId,
  getSocialQueueItemById,
  saveOperatorCandidateLink,
  saveSocialResult,
  upsertSocialQueueItem,
} from "./phase2-store";
import { appendStagedOperatorEvidence, createSourceIntakeId, getSourceIntakeById, listOperatorCandidates, listParsedCandidates } from "./store";
import type { SocialDiscoveryResult, SocialSurfaceType, ValidationReviewOutcome } from "./phase2-types";
import type { ParsedCandidateRow, StagedOperatorEvidence } from "./types";

type SurfaceCandidate = {
  type: SocialSurfaceType;
  value: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeSurfaceValue(type: SocialSurfaceType, value: string): string {
  const url = normalizeUrl(value);
  if (type === "instagram" || type === "tiktok") {
    const handle = extractHandle(type, url);
    return handle || value.trim();
  }
  return url;
}

function pushSurface(target: Map<string, SurfaceCandidate>, surface: SurfaceCandidate) {
  const key = `${surface.type}|${normalizeText(surface.value)}`;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, surface);
    return;
  }
  const rank = { low: 1, medium: 2, high: 3 };
  if (rank[surface.confidence] > rank[existing.confidence]) {
    target.set(key, surface);
  }
}

function contextTerm(queueItem: Awaited<ReturnType<typeof getSocialQueueItemById>> extends infer T ? NonNullable<T> : never): string | undefined {
  return queueItem.facilityName || queueItem.sourceLabel || queueItem.city;
}

function buildSocialQueries(
  queueItem: Awaited<ReturnType<typeof getSocialQueueItemById>> extends infer T ? NonNullable<T> : never,
  candidate: ParsedCandidateRow | null,
  matchedOperator?: { canonicalWebsite?: string; canonicalPhone?: string }
): Array<{ query: string; kind: SocialSurfaceType | "website"; reason: string }> {
  const anchor = {
    name: queueItem.displayName,
    category: candidate?.roleLabel,
    city: queueItem.city,
    zone: queueItem.state,
    website: matchedOperator?.canonicalWebsite,
    phone: matchedOperator?.canonicalPhone,
  };
  const baseQueries = buildGoogleDiscoveryPack(anchor).queries.slice(0, 4);
  const queries: Array<{ query: string; kind: SocialSurfaceType | "website"; reason: string }> = baseQueries.map((query) => ({
    query: query.query,
    kind:
      query.type === "instagram"
        ? "instagram"
        : query.type === "tiktok"
          ? "tiktok"
          : query.type === "linktree"
            ? "linktree"
            : "website",
    reason: query.notes || "google discovery query",
  }));

  const quotedName = `"${queueItem.displayName}"`;
  const geo = queueItem.city ? `"${queueItem.city}"` : queueItem.state ? `"${queueItem.state}"` : "";
  const context = contextTerm(queueItem) ? `"${contextTerm(queueItem)}"` : "";
  const custom = [
    { query: `${quotedName} ${context} ${geo} instagram`.trim(), kind: "instagram" as const, reason: "name plus facility context" },
    { query: `${quotedName} ${context} ${geo} glossgenius`.trim(), kind: "booking" as const, reason: "booking platform query" },
    { query: `${quotedName} ${context} ${geo} vagaro`.trim(), kind: "booking" as const, reason: "booking platform query" },
    { query: `${quotedName} ${context} ${geo} booksy`.trim(), kind: "booking" as const, reason: "booking platform query" },
    { query: `${quotedName} ${context} ${geo} fresha`.trim(), kind: "booking" as const, reason: "booking platform query" },
    { query: `${quotedName} ${context} ${geo} website`.trim(), kind: "website" as const, reason: "official website query" },
  ];

  for (const item of custom) {
    if (!item.query.trim()) continue;
    if (!queries.some((row) => normalizeText(row.query) === normalizeText(item.query))) {
      queries.push(item);
    }
  }

  return queries.slice(0, 6);
}

function surfaceTypeFromUrl(url: string): SocialSurfaceType | null {
  const platform = detectPlatformFromUrl(url);
  if (platform === "instagram") return "instagram";
  if (platform === "booking") return "booking";
  if (platform === "website") return "website";
  if (platform === "linktree") return "linktree";
  if (platform === "tiktok") return "tiktok";
  return null;
}

function buildReasonBundle(input: {
  queueName: string;
  candidateTitle?: string;
  query: string;
  reason: string;
  city?: string;
}): { confidence: "high" | "medium" | "low"; reasons: string[] } {
  const reasons = [input.reason, `query=${input.query}`];
  const similarity = nameSimilarityScore(input.queueName, input.candidateTitle || "");
  if (similarity >= 0.9) reasons.push("strong name alignment in search title");
  else if (similarity >= 0.72) reasons.push("usable name overlap in search title");
  if (input.city && normalizeText(input.candidateTitle).includes(normalizeText(input.city))) {
    reasons.push("city appears in search title or snippet");
  }
  const confidence = similarity >= 0.9 ? "high" : similarity >= 0.72 ? "medium" : "low";
  return { confidence, reasons };
}

async function queueCandidateRow(intakeId: string, candidateId: string): Promise<ParsedCandidateRow | null> {
  const rows = await listParsedCandidates(intakeId);
  return rows.find((row) => row.id === candidateId) ?? null;
}

function deriveTargetOperatorId(candidate: ParsedCandidateRow | null, mergeTargetId?: string): string | undefined {
  return mergeTargetId?.trim() || candidate?.suggestedMatch?.matchedOperatorId || undefined;
}

async function finalizeResult(
  queueItem: Awaited<ReturnType<typeof getSocialQueueItemById>> extends infer T ? NonNullable<T> : never,
  result: SocialDiscoveryResult,
  options?: { action?: ValidationReviewOutcome; mergeTargetId?: string; resolvedBy?: string },
  parsedCandidate?: ParsedCandidateRow | null
): Promise<SocialDiscoveryResult> {
  if (!options?.action) return result;

  const reviewedAt = new Date().toISOString();
  const finalResult: SocialDiscoveryResult = {
    ...result,
    finalStatus: options.action,
    mergeTargetId: options.action === "merged" ? options.mergeTargetId?.trim() || undefined : undefined,
    reviewedAt,
    reviewedBy: options.resolvedBy,
    targetOperatorId: deriveTargetOperatorId(parsedCandidate ?? null, options.mergeTargetId),
  };
  await saveSocialResult(finalResult);
  await upsertSocialQueueItem({
    ...queueItem,
    status: options.action,
    lastAttemptAt: reviewedAt,
  });
  return finalResult;
}

async function writeSocialEvidence(
  queueItem: Awaited<ReturnType<typeof getSocialQueueItemById>> extends infer T ? NonNullable<T> : never,
  parsedCandidate: ParsedCandidateRow | null,
  surfaces: SurfaceCandidate[],
  observedAt: string
): Promise<StagedOperatorEvidence[]> {
  const operatorId = parsedCandidate?.suggestedMatch?.matchedOperatorId;
  const rows: StagedOperatorEvidence[] = [];
  for (const surface of surfaces) {
    const factType =
      surface.type === "instagram"
        ? "instagram_handle"
        : surface.type === "booking"
          ? "booking_url"
          : surface.type === "website"
            ? "website_url"
            : surface.type === "linktree"
              ? "linktree_url"
              : "tiktok_handle";
    rows.push({
      id: createSourceIntakeId("soe"),
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      operatorId,
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: queueItem.sourceUrl,
      observedAt,
      candidateName: queueItem.displayName,
      factType,
      factValue: normalizeSurfaceValue(surface.type, surface.value),
      confidence: surface.confidence,
    });
  }
  if (rows.length) await appendStagedOperatorEvidence(rows);
  return rows;
}

async function maybeSaveOperatorLinks(
  queueItem: Awaited<ReturnType<typeof getSocialQueueItemById>> extends infer T ? NonNullable<T> : never,
  parsedCandidate: ParsedCandidateRow | null,
  surfaces: SurfaceCandidate[],
  createdAt: string
): Promise<void> {
  const operators = loadResolverRegistry().filter((row) => !row.isContainer);
  for (const surface of surfaces) {
    const normalized = normalizeText(normalizeSurfaceValue(surface.type, surface.value));
    const matchedOperator = operators.find((row) => {
      if (surface.type === "instagram") return normalizeText(row.canonicalInstagram) === normalized;
      if (surface.type === "booking") return normalizeText(row.canonicalBooking) === normalized;
      if (surface.type === "website") return normalizeText(row.canonicalWebsite) === normalized;
      return false;
    });
    if (matchedOperator) {
      await saveOperatorCandidateLink({
        id: createSourceIntakeId("ocl"),
        candidateId: queueItem.candidateId,
        targetType: "operator",
        targetId: matchedOperator.id,
        score: surface.confidence === "high" ? 92 : surface.confidence === "medium" ? 78 : 62,
        reasons: [...surface.reasons, "discovered surface already exists on resolver operator"],
        createdAt,
      });
      return;
    }
  }

  const unresolved = (await listOperatorCandidates()).find(
    (row) =>
      row.sourceIntakeId === queueItem.intakeId &&
      normalizeText(row.displayName) === normalizeText(parsedCandidate?.displayName || queueItem.displayName)
  );
  if (unresolved && surfaces.length) {
    await saveOperatorCandidateLink({
      id: createSourceIntakeId("ocl"),
      candidateId: queueItem.candidateId,
      targetType: "operator_candidate",
      targetId: unresolved.id,
      score: surfaces.some((surface) => surface.confidence === "high") ? 88 : 72,
      reasons: ["social discovery added surface evidence for unresolved operator candidate"],
      createdAt,
    });
  }
}

export async function resolveSocialQueueItem(
  queueItemId: string,
  options?: { resolvedBy?: string; action?: ValidationReviewOutcome; mergeTargetId?: string }
): Promise<SocialDiscoveryResult> {
  const existing = await findSocialResultByQueueItemId(queueItemId);
  const queueItem = await getSocialQueueItemById(queueItemId);
  if (!queueItem) throw new Error("social_queue_item_not_found");
  const parsedCandidate = await queueCandidateRow(queueItem.intakeId, queueItem.candidateId);

  if (existing) {
    return finalizeResult(queueItem, existing, options, parsedCandidate);
  }

  const startedAt = new Date().toISOString();
  await upsertSocialQueueItem({
    ...queueItem,
    status: "processing",
    attempts: queueItem.attempts + 1,
    lastAttemptAt: startedAt,
  });

  try {
    const [intake] = await Promise.all([
      getSourceIntakeById(queueItem.intakeId),
    ]);
    const matchedOperator = parsedCandidate?.suggestedMatch?.matchedOperatorId
      ? loadResolverRegistry().find((row) => row.id === parsedCandidate.suggestedMatch?.matchedOperatorId)
      : undefined;

    const discovered = new Map<string, SurfaceCandidate>();

    for (const directUrl of [queueItem.sourceUrl, intake?.sourceUrl, matchedOperator?.canonicalWebsite].filter(
      (value): value is string => Boolean(value)
    )) {
      const type = surfaceTypeFromUrl(directUrl);
      if (!type) continue;
      pushSurface(discovered, {
        type,
        value: directUrl,
        confidence: type === "website" ? "medium" : "high",
        reasons: ["surface derived directly from existing source context"],
      });
    }

    const queries = buildSocialQueries(queueItem, parsedCandidate, matchedOperator);
    for (const query of queries) {
      const results = await runGoogleSearch(query.query, 3, { strictQuery: true });
      for (const result of results) {
        const type = surfaceTypeFromUrl(result.link);
        if (!type) continue;
        const bundle = buildReasonBundle({
          queueName: queueItem.displayName,
          candidateTitle: `${result.title || ""} ${result.snippet || ""}`.trim(),
          query: query.query,
          reason: query.reason,
          city: queueItem.city,
        });
        pushSurface(discovered, {
          type,
          value: result.link,
          confidence: bundle.confidence,
          reasons: bundle.reasons,
        });
      }
    }

    const resolvedAt = new Date().toISOString();
    const surfaces = [...discovered.values()].slice(0, 8);
    const evidenceRows = await writeSocialEvidence(queueItem, parsedCandidate, surfaces, resolvedAt);
    const result: SocialDiscoveryResult = {
      id: createSourceIntakeId("sdr"),
      queueItemId: queueItem.id,
      intakeId: queueItem.intakeId,
      candidateId: queueItem.candidateId,
      resolvedAt,
      discoveredSurfaces: surfaces.map((surface) => ({
        type: surface.type,
        value: normalizeSurfaceValue(surface.type, surface.value),
        confidence: surface.confidence,
        reasons: surface.reasons,
      })),
      evidenceIds: evidenceRows.map((row) => row.id),
      targetOperatorId: deriveTargetOperatorId(parsedCandidate),
    };
    await saveSocialResult(result);
    await maybeSaveOperatorLinks(queueItem, parsedCandidate, surfaces, resolvedAt);
    const queueStatus = options?.action || "resolved";
    await upsertSocialQueueItem({
      ...queueItem,
      status: queueStatus,
      attempts: queueItem.attempts + 1,
      lastAttemptAt: startedAt,
    });
    return finalizeResult(queueItem, result, options, parsedCandidate);
  } catch (error) {
    await upsertSocialQueueItem({
      ...queueItem,
      status: "failed",
      attempts: queueItem.attempts + 1,
      lastAttemptAt: startedAt,
    });
    throw error;
  }
}
