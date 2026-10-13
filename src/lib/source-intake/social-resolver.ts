import { buildGoogleDiscoveryPack } from "@/lib/social-targets/google-discovery/query-generator";
import { nameSimilarityScore } from "@/lib/social-targets/evidence";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { extractHandle } from "@/lib/social-targets/social-normalization";
import { candidateInstagramUrl, classifyProfileUrl, recoverCandidateProfile } from "@/lib/admin/pipeline/profile-model";
import type { CandidateProfile } from "@/lib/admin/pipeline/profile-types";
import {
  findSocialResultByQueueItemId,
  getSocialQueueItemById,
  saveSocialResult,
  upsertSocialQueueItem,
} from "./phase2-store";
import { appendStagedOperatorEvidence, createSourceIntakeId, listParsedCandidates } from "./store";
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
  profile?: CandidateProfile
): Array<{ query: string; kind: SocialSurfaceType | "website"; reason: string }> {
  if (!candidate) return [];
  const anchor = {
    name: queueItem.displayName,
    category: candidate?.roleLabel,
    city: queueItem.city,
    zone: queueItem.state,
    website: profile?.websiteLinks.find((link) => link.attribution === "candidate")?.url,
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
  const classified = classifyProfileUrl(url);
  if (!classified || classified.kind === "directory") return null;
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const onHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (onHost("instagram.com")) return candidateInstagramUrl(url) ? "instagram" : null;
  if (onHost("tiktok.com")) return /^\/@[a-z0-9._]+\/?$/i.test(parsed.pathname) ? "tiktok" : null;
  if (onHost("linktr.ee")) return "linktree";
  if (classified.platform !== "unknown") return classified.kind === "individual" || classified.kind === "shared_business" ? "booking" : null;
  return classified.kind === "website" ? "website" : null;
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
  reasons.push("search_discovery_only_not_fetched_or_identity_verified");
  return { confidence: "low", reasons };
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
    targetOperatorId: options.action === "approved" || options.action === "merged"
      ? deriveTargetOperatorId(parsedCandidate ?? null, options.mergeTargetId) : undefined,
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
  // Discovery is candidate-scoped staging. A suggested match is not an approved operator link.
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
      facilityId: queueItem.facilityId,
      sourceType: queueItem.sourceType,
      sourceLabel: queueItem.sourceLabel,
      sourceUrl: surface.value,
      observedAt,
      candidateName: parsedCandidate?.displayName || queueItem.displayName,
      factType,
      factValue: normalizeSurfaceValue(surface.type, surface.value),
      confidence: surface.confidence,
    });
  }
  if (rows.length) await appendStagedOperatorEvidence(rows);
  return rows;
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
    const profile = parsedCandidate ? recoverCandidateProfile(parsedCandidate) : undefined;
    const scopedQueue = {
      ...queueItem,
      displayName: parsedCandidate?.displayName || queueItem.displayName,
      city: profile?.city,
      state: profile?.state,
      facilityName: profile?.businessName,
    };
    const discovered = new Map<string, SurfaceCandidate>();
    const directLinks = profile ? [...profile.bookingLinks, ...profile.socialLinks, ...profile.websiteLinks] : [];
    for (const link of directLinks) {
      const type = surfaceTypeFromUrl(link.url);
      if (!type || link.attribution === "unresolved") continue;
      pushSurface(discovered, {
        type,
        value: link.url,
        confidence: "medium",
        reasons: [
          "candidate_source_reported_link_not_fetched_or_identity_verified",
          `source_basis=${link.basis}`,
          ...(link.kind === "shared_business" || link.attribution === "business" ? ["shared_business_link_not_provider_identity"] : []),
        ],
      });
    }

    const queries = buildSocialQueries(scopedQueue, parsedCandidate, profile);
    for (const query of queries) {
      const results = await runGoogleSearch(query.query, 3, { strictQuery: true });
      for (const result of results) {
        const type = surfaceTypeFromUrl(result.link);
        if (!type) continue;
        const bundle = buildReasonBundle({
          queueName: scopedQueue.displayName,
          candidateTitle: `${result.title || ""} ${result.snippet || ""}`.trim(),
          query: query.query,
          reason: query.reason,
          city: scopedQueue.city,
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
    };
    await saveSocialResult(result);
    // Discovery-only surfaces never auto-link to a canonical or same-name unresolved operator.
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
