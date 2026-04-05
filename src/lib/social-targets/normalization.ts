import type {
  ProfileHealth,
  SocialProfilePlatform,
  SocialResolveStatus,
  SocialTarget,
  SocialTargetSocialProfile,
} from "@/types/social-target";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_DISCOVERY_SOURCES,
  SOCIAL_RESOLVE_STATUSES,
  SOCIAL_ACTIVITY_STATUSES,
  SOCIAL_VERIFICATION_STATUSES,
  SOCIAL_VISIBILITY_STATES,
} from "@/lib/social-targets/social-profile-constants";

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
export function inferPlatformFromTarget(t: SocialTarget): SocialProfilePlatform {
  const url = t.socialProfile?.url?.toLowerCase() ?? "";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("linktr.ee") || url.includes("linktree")) return "linktree";
  if (url.includes("instagram.com")) return "instagram";
  if (url && /^https?:\/\//i.test(url) && !url.includes("instagram") && !url.includes("tiktok")) return "website";
  return "instagram";
}

/**
 * Ensure `socialProfile` exists with safe defaults derived from legacy fields.
 * Does not remove legacy keys — loaders merge for UI + visibility helpers.
 */
export function normalizeSocialTarget(t: SocialTarget): SocialTarget {
  const platform = t.socialProfile?.platform ?? inferPlatformFromTarget(t);
  const handle = t.socialProfile?.handle?.replace(/^@/, "").trim() || t.handle.replace(/^@/, "").trim();
  const resolveFromExplicit = t.socialProfile?.resolveStatus;
  const resolveStatus = resolveFromExplicit ?? mapProfileHealthToResolveStatus(t.profileHealth);

  let verificationStatus = t.socialProfile?.verificationStatus;
  if (!verificationStatus) {
    if (t.profileHealth === "active" && t.lastVerifiedAt) verificationStatus = "auto_verified";
    else verificationStatus = "candidate";
  }

  let activityStatus = t.socialProfile?.activityStatus;
  if (!activityStatus) {
    if (t.profileHealth === "stale") activityStatus = "stale";
    else if (t.activitySignal === "hot" || t.activitySignal === "warm") activityStatus = "recent";
    else activityStatus = "unknown";
  }

  const socialProfile: SocialTargetSocialProfile = {
    ...t.socialProfile,
    platform,
    handle,
    resolveStatus,
    verificationStatus,
    activityStatus,
    lastVerifiedAt: t.socialProfile?.lastVerifiedAt ?? t.lastVerifiedAt ?? null,
  };

  if (!t.socialProfile?.url && platform === "instagram") {
    socialProfile.url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  }

  return { ...t, socialProfile };
}

/** Apply partial `socialProfile` updates and re-run normalization for derived fields. */
export function patchSocialProfile(t: SocialTarget, patch: Partial<SocialTargetSocialProfile>): SocialTarget {
  return normalizeSocialTarget({
    ...t,
    socialProfile: { ...t.socialProfile, ...patch },
  });
}
