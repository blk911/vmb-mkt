import {
  ensureSocialCandidates,
  getPrimaryCandidate,
  ingestSourceCandidateInputs,
  mergeSocialProfileIntoPrimaryCandidate,
} from "@/lib/social-targets/social-candidate-logic";
import { appendEvidenceToTarget, normalizeSocialTargetRecord } from "@/lib/social-targets/evidence";
import type { DiscoveryAnchor } from "@/lib/social-targets/google-discovery/query-generator";
import {
  buildGoogleDiscoveryQueries,
  adaptQueryResultsToCandidates,
  adaptQueryResultsToEvidence,
  type GoogleQueryResultSet,
} from "@/lib/social-targets/google-discovery/run-discovery";
import { adaptSourceRecord } from "@/lib/social-targets/source-adapters";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_DISCOVERY_SOURCES,
  SOCIAL_RESOLVE_STATUSES,
  SOCIAL_ACTIVITY_STATUSES,
  SOCIAL_VERIFICATION_STATUSES,
  SOCIAL_VISIBILITY_STATES,
} from "@/lib/social-targets/social-profile-constants";
import type {
  ProfileHealth,
  SocialPlatform,
  SocialResolveStatus,
  SocialTarget,
  SocialTargetSocialProfile,
} from "@/types/social-target";
import type { SourceCandidateInput, SourceType } from "@/lib/social-targets/source-adapters";

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

/** Parse `socialProfile` from API/JSON; returns undefined if invalid or empty. */
export function parseSocialProfile(raw: unknown): SocialTargetSocialProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: SocialTargetSocialProfile = {};

  if (isOneOf(o.platform, SOCIAL_PLATFORMS)) out.platform = o.platform;
  if (typeof o.url === "string" && o.url.trim()) out.url = o.url.trim();
  if (typeof o.handle === "string" && o.handle.trim()) out.handle = o.handle.trim();
  if (isOneOf(o.discoverySource, SOCIAL_DISCOVERY_SOURCES)) out.discoverySource = o.discoverySource;
  if (isOneOf(o.resolveStatus, SOCIAL_RESOLVE_STATUSES)) out.resolveStatus = o.resolveStatus;
  if (isOneOf(o.activityStatus, SOCIAL_ACTIVITY_STATUSES)) out.activityStatus = o.activityStatus;
  if (isOneOf(o.verificationStatus, SOCIAL_VERIFICATION_STATUSES)) out.verificationStatus = o.verificationStatus;
  if (isOneOf(o.visibilityState, SOCIAL_VISIBILITY_STATES)) out.visibilityState = o.visibilityState;

  if (typeof o.matchConfidence === "number" && Number.isFinite(o.matchConfidence)) {
    out.matchConfidence = clampInt(o.matchConfidence, 0, 100);
  }
  if (typeof o.geoConfidence === "number" && Number.isFinite(o.geoConfidence)) {
    out.geoConfidence = clampInt(o.geoConfidence, 0, 100);
  }
  if (typeof o.categoryConfidence === "number" && Number.isFinite(o.categoryConfidence)) {
    out.categoryConfidence = clampInt(o.categoryConfidence, 0, 100);
  }
  if (typeof o.lastCheckedAt === "string") out.lastCheckedAt = o.lastCheckedAt;
  else if (o.lastCheckedAt === null) out.lastCheckedAt = null;
  if (typeof o.lastVerifiedAt === "string") out.lastVerifiedAt = o.lastVerifiedAt;
  else if (o.lastVerifiedAt === null) out.lastVerifiedAt = null;

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

/** Map legacy profile health to resolve status when `socialProfile.resolveStatus` is absent. */
export function mapProfileHealthToResolveStatus(health?: ProfileHealth): SocialResolveStatus {
  switch (health) {
    case "active":
      return "live";
    case "not_found":
      return "dead";
    case "renamed_or_moved":
      return "redirect";
    case "private":
      return "blocked";
    case "stale":
      return "live";
    default:
      return "unknown";
  }
}

/** Infer platform from handle/URL when unset (non-SSR heuristic). */
export function inferPlatformFromTarget(t: SocialTarget): SocialPlatform {
  const url = t.socialProfile?.url?.toLowerCase() ?? "";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("linktr.ee") || url.includes("linktree")) return "linktree";
  if (url.includes("instagram.com")) return "instagram";
  if (url && /^https?:\/\//i.test(url) && !url.includes("instagram") && !url.includes("tiktok")) return "website";
  return "instagram";
}

/**
 * Ensure candidates exist, merge legacy `socialProfile` edits into primary, sync root `handle` + `socialProfile` from primary.
 */
export function normalizeSocialTarget(t: SocialTarget): SocialTarget {
  let base = normalizeSocialTargetRecord(t);
  base = ensureSocialCandidates(base);
  if (t.socialProfile) {
    base = mergeSocialProfileIntoPrimaryCandidate({ ...base, socialProfile: t.socialProfile });
  }
  const primary = getPrimaryCandidate(base);
  if (!primary) return base;

  const handle = (primary.handle ?? base.handle).replace(/^@/, "").trim();
  const socialProfile: SocialTargetSocialProfile = {
    ...base.socialProfile,
    platform: primary.platform,
    handle: primary.handle ?? handle,
    url: primary.url,
    resolveStatus: primary.resolveStatus,
    activityStatus: primary.activityStatus,
    verificationStatus: primary.verificationStatus,
    visibilityState: primary.visibilityState,
    matchConfidence: primary.overallConfidenceScore,
    geoConfidence: primary.geoMatchScore,
    categoryConfidence: primary.categoryMatchScore,
    lastCheckedAt: primary.lastCheckedAt ?? null,
    lastVerifiedAt: primary.lastVerifiedAt ?? null,
  };

  return { ...base, handle, socialProfile };
}

/** Apply partial `socialProfile` updates and re-run normalization for derived fields. */
export function patchSocialProfile(t: SocialTarget, patch: Partial<SocialTargetSocialProfile>): SocialTarget {
  return normalizeSocialTarget({
    ...t,
    socialProfile: { ...t.socialProfile, ...patch },
  });
}

/**
 * Bridge helper for source adapters: normalize one raw source record into candidate inputs,
 * then ingest into existing candidate pipeline.
 */
export function adaptAndIngestSourceRecord(
  target: SocialTarget,
  sourceType: SourceType,
  rawRecord: unknown
): SocialTarget {
  const inputs = adaptSourceRecord(sourceType, rawRecord);
  return ingestSourceCandidateInputs(target, inputs);
}

/** Ingest already-normalized source adapter inputs into the current candidate pipeline. */
export function ingestNormalizedSourceCandidates(
  target: SocialTarget,
  inputs: SourceCandidateInput[]
): SocialTarget {
  return ingestSourceCandidateInputs(target, inputs);
}

/**
 * Google discovery integration hook:
 * build query pack from anchor, adapt public search results into normalized source inputs,
 * then ingest as unverified candidates into the existing pipeline.
 */
export function runGoogleDiscoveryForTarget(
  target: SocialTarget,
  anchor: DiscoveryAnchor,
  googleResults: GoogleQueryResultSet[],
  runMeta?: Pick<SocialTarget, "runId" | "runType" | "sourceVersion">
): {
  target: SocialTarget;
  queries: ReturnType<typeof buildGoogleDiscoveryQueries>["queries"];
  inputs: SourceCandidateInput[];
} {
  const pack = buildGoogleDiscoveryQueries(anchor);
  const inputs = adaptQueryResultsToCandidates(googleResults, anchor);
  const evidence = adaptQueryResultsToEvidence(googleResults, anchor);
  const ingested = ingestSourceCandidateInputs(target, inputs);
  const next = normalizeSocialTarget(appendEvidenceToTarget(ingested, evidence, runMeta));
  return { target: next, queries: pack.queries, inputs };
}
