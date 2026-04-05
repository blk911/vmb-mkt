import { recomputeCandidateScores } from "@/lib/social-targets/social-scoring";
import {
  SOCIAL_CANDIDATE_DISCOVERY_SOURCES,
  SOCIAL_PLATFORMS,
  SOCIAL_RESOLVE_STATUSES,
  SOCIAL_ACTIVITY_STATUSES,
  SOCIAL_VERIFICATION_STATUSES,
  SOCIAL_VISIBILITY_STATES,
} from "@/lib/social-targets/social-profile-constants";
import { buildCanonicalProfileUrl, detectPlatformFromUrl } from "@/lib/social-targets/social-normalization";
import type { SocialVerificationResult } from "@/lib/social-targets/social-verification";
import type {
  ProfileHealth,
  SocialCandidate,
  SocialCandidateDiscoverySource,
  SocialPlatform,
  SocialResolveStatus,
  SocialTarget,
  SocialTargetSocialProfile,
} from "@/types/social-target";

function mapProfileHealthToResolveStatus(health?: ProfileHealth): SocialResolveStatus {
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

function inferPlatformForLegacyTarget(t: SocialTarget): SocialPlatform {
  const url = t.socialProfile?.url?.toLowerCase() ?? "";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("linktr.ee") || url.includes("linktree")) return "linktree";
  if (url.includes("instagram.com")) return "instagram";
  if (url && /^https?:\/\//i.test(url)) return "website";
  return "instagram";
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

export function parseSocialCandidate(raw: unknown): SocialCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id)) return null;
  const platform = isOneOf(o.platform, SOCIAL_PLATFORMS) ? o.platform : "unknown";
  const discoverySource = isOneOf(o.discoverySource, SOCIAL_CANDIDATE_DISCOVERY_SOURCES)
    ? o.discoverySource
    : "seed";
  const resolveStatus = isOneOf(o.resolveStatus, SOCIAL_RESOLVE_STATUSES) ? o.resolveStatus : "unknown";
  const activityStatus = isOneOf(o.activityStatus, SOCIAL_ACTIVITY_STATUSES) ? o.activityStatus : "unknown";
  const verificationStatus = isOneOf(o.verificationStatus, SOCIAL_VERIFICATION_STATUSES)
    ? o.verificationStatus
    : "candidate";

  const c: SocialCandidate = {
    id: String(o.id).trim(),
    platform,
    discoverySource,
    resolveStatus,
    activityStatus,
    verificationStatus,
    businessMatchScore: clampNum(o.businessMatchScore, 0, 100),
    geoMatchScore: clampNum(o.geoMatchScore, 0, 100),
    categoryMatchScore: clampNum(o.categoryMatchScore, 0, 100),
    activityScore: clampNum(o.activityScore, 0, 100),
    overallConfidenceScore: clampNum(o.overallConfidenceScore, 0, 100),
  };
  if (typeof o.url === "string" && o.url.trim()) c.url = o.url.trim();
  if (typeof o.handle === "string" && o.handle.trim()) c.handle = o.handle.trim();
  if (typeof o.notes === "string") c.notes = o.notes;
  if (Array.isArray(o.evidence)) c.evidence = o.evidence.filter((x): x is string => typeof x === "string");
  if (isOneOf(o.visibilityState, SOCIAL_VISIBILITY_STATES)) c.visibilityState = o.visibilityState;
  if (typeof o.lastCheckedAt === "string") c.lastCheckedAt = o.lastCheckedAt;
  else if (o.lastCheckedAt === null) c.lastCheckedAt = null;
  if (typeof o.lastVerifiedAt === "string") c.lastVerifiedAt = o.lastVerifiedAt;
  else if (o.lastVerifiedAt === null) c.lastVerifiedAt = null;
  return c;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function clampNum(v: unknown, lo: number, hi: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return clampInt(v, lo, hi);
}

function mapLegacyDiscovery(s?: SocialTargetSocialProfile["discoverySource"]): SocialCandidateDiscoverySource {
  if (s === "maps") return "maps";
  if (s === "website_scrape") return "website_scrape";
  if (s === "heuristic") return "heuristic";
  if (s === "manual") return "manual";
  if (s === "referral") return "referral";
  return "seed";
}

/** Build default candidate row from legacy handle + socialProfile + profileHealth. */
export function buildLegacyCandidate(t: SocialTarget): SocialCandidate {
  const id = `${t.id}-legacy`;
  const platform = (t.socialProfile?.platform as SocialPlatform) ?? inferPlatformForLegacyTarget(t);
  const handle = (t.socialProfile?.handle ?? t.handle).replace(/^@/, "").trim();
  const url =
    t.socialProfile?.url ??
    buildCanonicalProfileUrl(platform === "unknown" ? "instagram" : platform, handle) ??
    undefined;
  const resolveStatus = t.socialProfile?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
  let verificationStatus = t.socialProfile?.verificationStatus;
  if (!verificationStatus) {
    verificationStatus = t.profileHealth === "active" && t.lastVerifiedAt ? "auto_verified" : "candidate";
  }
  let activityStatus = t.socialProfile?.activityStatus;
  if (!activityStatus) {
    if (t.profileHealth === "stale") activityStatus = "stale";
    else if (t.activitySignal === "hot" || t.activitySignal === "warm") activityStatus = "recent";
    else activityStatus = "unknown";
  }
  const base: SocialCandidate = {
    id,
    platform: platform === "unknown" ? "instagram" : platform,
    handle,
    url,
    discoverySource: mapLegacyDiscovery(t.socialProfile?.discoverySource),
    resolveStatus,
    activityStatus,
    verificationStatus,
    businessMatchScore: 0,
    geoMatchScore: 0,
    categoryMatchScore: 0,
    activityScore: 0,
    overallConfidenceScore: 0,
    lastCheckedAt: t.socialProfile?.lastCheckedAt ?? null,
    lastVerifiedAt: t.socialProfile?.lastVerifiedAt ?? t.lastVerifiedAt ?? null,
    visibilityState: t.socialProfile?.visibilityState ?? "show",
    evidence: [],
  };
  return recomputeCandidateScores(base, t);
}

export function ensureSocialCandidates(t: SocialTarget): SocialTarget {
  if (t.socialCandidates && t.socialCandidates.length > 0) {
    const normalized = t.socialCandidates.map((c) => recomputeCandidateScores({ ...c }, t));
    return { ...t, socialCandidates: normalized };
  }
  const legacy = buildLegacyCandidate(t);
  return {
    ...t,
    socialCandidates: [legacy],
    primaryCandidateId: t.primaryCandidateId ?? legacy.id,
  };
}

export function getPrimaryCandidate(t: SocialTarget): SocialCandidate | null {
  const ensured = ensureSocialCandidates(t);
  const list = ensured.socialCandidates ?? [];
  if (!list.length) return null;

  const isUsable = (c: SocialCandidate) =>
    c.resolveStatus !== "dead" && c.verificationStatus !== "rejected" && c.visibilityState !== "hide";

  if (ensured.primaryCandidateId) {
    const found = list.find((c) => c.id === ensured.primaryCandidateId);
    if (found && isUsable(found)) return found;
  }

  const manual = list.find((c) => c.verificationStatus === "manual_verified" && isUsable(c));
  if (manual) return manual;

  const auto = list.filter((c) => c.verificationStatus === "auto_verified" && c.resolveStatus === "live" && isUsable(c));
  if (auto.length) return [...auto].sort((a, b) => b.overallConfidenceScore - a.overallConfidenceScore)[0];

  const ranked = list.filter(
    (c) => c.resolveStatus === "live" && isUsable(c) && c.overallConfidenceScore >= 50
  );
  if (ranked.length) return [...ranked].sort((a, b) => b.overallConfidenceScore - a.overallConfidenceScore)[0];

  const notDead = list.find((c) => c.resolveStatus !== "dead" && c.verificationStatus !== "rejected");
  return notDead ?? list[0];
}

/** Merge API `socialProfile` edits into the primary candidate, then re-score. */
export function mergeSocialProfileIntoPrimaryCandidate(t: SocialTarget): SocialTarget {
  const ensured = ensureSocialCandidates(t);
  if (!t.socialProfile) return ensured;
  const pid = ensured.primaryCandidateId ?? ensured.socialCandidates![0].id;
  const next = ensured.socialCandidates!.map((c) => {
    if (c.id !== pid) return c;
    const sp = t.socialProfile!;
    const platform = (sp.platform as SocialPlatform) ?? c.platform;
    const handle = (sp.handle ?? c.handle ?? t.handle).replace(/^@/, "").trim();
    return recomputeCandidateScores(
      {
        ...c,
        platform,
        handle,
        url: sp.url ?? c.url ?? buildCanonicalProfileUrl(platform, handle),
        resolveStatus: sp.resolveStatus ?? c.resolveStatus,
        activityStatus: sp.activityStatus ?? c.activityStatus,
        verificationStatus: sp.verificationStatus ?? c.verificationStatus,
        visibilityState: sp.visibilityState ?? c.visibilityState,
        lastCheckedAt: sp.lastCheckedAt ?? c.lastCheckedAt,
        lastVerifiedAt: sp.lastVerifiedAt ?? c.lastVerifiedAt,
        discoverySource: mapLegacyDiscovery(sp.discoverySource),
      },
      ensured
    );
  });
  return { ...ensured, socialCandidates: next };
}

export function applyVerificationToCandidate(
  t: SocialTarget,
  candidateId: string,
  result: SocialVerificationResult,
  opts?: { autoVerify?: boolean }
): SocialTarget {
  const ensured = ensureSocialCandidates(t);
  const next = ensured.socialCandidates!.map((c) => {
    if (c.id !== candidateId) return c;
    const merged: SocialCandidate = {
      ...c,
      resolveStatus: result.resolveStatus,
      activityStatus: result.activityStatus,
      lastCheckedAt: result.lastCheckedAt,
      evidence: [...(c.evidence ?? []), ...result.evidence].slice(-12),
    };
    if (opts?.autoVerify && result.resolveStatus === "live") {
      merged.verificationStatus = "auto_verified";
      merged.lastVerifiedAt = result.lastCheckedAt;
    }
    return recomputeCandidateScores(merged, ensured, result);
  });
  return { ...ensured, socialCandidates: next };
}

export function patchCandidate(
  t: SocialTarget,
  candidateId: string,
  patch: Partial<SocialCandidate>
): SocialTarget {
  const ensured = ensureSocialCandidates(t);
  const next = ensured.socialCandidates!.map((c) =>
    c.id === candidateId ? recomputeCandidateScores({ ...c, ...patch }, ensured) : c
  );
  return { ...ensured, socialCandidates: next };
}

export function setPrimaryCandidateId(t: SocialTarget, candidateId: string): SocialTarget {
  const ensured = ensureSocialCandidates(t);
  if (!ensured.socialCandidates!.some((c) => c.id === candidateId)) return ensured;
  return { ...ensured, primaryCandidateId: candidateId };
}

export function addManualCandidate(
  t: SocialTarget,
  input: { platform: SocialPlatform; handle?: string; url?: string }
): SocialTarget {
  const ensured = ensureSocialCandidates(t);
  const id = `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const handle = input.handle?.replace(/^@/, "").trim() ?? "";
  const url =
    input.url?.trim() ||
    buildCanonicalProfileUrl(input.platform, handle) ||
    undefined;
  const base: SocialCandidate = {
    id,
    platform: input.platform,
    handle: handle || undefined,
    url,
    discoverySource: "manual",
    resolveStatus: "unknown",
    activityStatus: "unknown",
    verificationStatus: "candidate",
    businessMatchScore: 0,
    geoMatchScore: 0,
    categoryMatchScore: 0,
    activityScore: 0,
    overallConfidenceScore: 0,
  };
  const scored = recomputeCandidateScores(base, ensured);
  return {
    ...ensured,
    socialCandidates: [scored, ...(ensured.socialCandidates ?? [])],
    primaryCandidateId: ensured.primaryCandidateId ?? id,
  };
}

/** For discovery hooks: attach URL from enrichment without full candidate metadata. */
export function ingestCandidateUrl(t: SocialTarget, url: string, source: SocialCandidateDiscoverySource): SocialTarget {
  const platform = detectPlatformFromUrl(url);
  const ensured = ensureSocialCandidates(t);
  const id = `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base: SocialCandidate = {
    id,
    platform: platform === "unknown" ? "website" : platform,
    url: url.trim(),
    discoverySource: source,
    resolveStatus: "unknown",
    activityStatus: "unknown",
    verificationStatus: "candidate",
    businessMatchScore: 0,
    geoMatchScore: 0,
    categoryMatchScore: 0,
    activityScore: 0,
    overallConfidenceScore: 0,
  };
  const scored = recomputeCandidateScores(base, ensured);
  return { ...ensured, socialCandidates: [...(ensured.socialCandidates ?? []), scored] };
}
