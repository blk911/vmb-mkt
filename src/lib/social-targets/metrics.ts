import type { SocialTarget } from "@/types/social-target";

export type SocialTargetMetrics = {
  totalTargets: number;
  withWebsite: number;
  withInstagram: number;
  withTikTok: number;
  withLinktree: number;
  withPhone: number;
  withEmail: number;
  resolved: number;
  partial: number;
  unknown: number;
  conflict: number;
  avgConfidence: number;
  multiSignal: number;
};

export type SocialTargetMetricsCompare = {
  baseline: SocialTargetMetrics;
  current: SocialTargetMetrics;
  delta: Record<keyof SocialTargetMetrics, number>;
};

function hasEvidenceType(t: SocialTarget, type: string): boolean {
  return (t.evidence ?? []).some((ev) => ev.type === type || ev.platform === type);
}

function hasPhoneEvidence(t: SocialTarget): boolean {
  return (t.evidence ?? []).some((ev) => Boolean(ev.extracted.phone) || ev.type === "phone_lookup");
}

function hasEmailEvidence(t: SocialTarget): boolean {
  return (t.evidence ?? []).some((ev) => Boolean(ev.extracted.email));
}

function hasWebsiteEvidence(t: SocialTarget): boolean {
  return hasEvidenceType(t, "website") || hasEvidenceType(t, "website_social");
}

function normalizeConfidence(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

export function computeSocialTargetMetrics(targets: SocialTarget[]): SocialTargetMetrics {
  const totalTargets = targets.length;
  const withWebsite = targets.filter((t) => hasWebsiteEvidence(t)).length;
  const withInstagram = targets.filter((t) => Boolean(t.platforms?.instagram) || hasEvidenceType(t, "instagram")).length;
  const withTikTok = targets.filter((t) => Boolean(t.platforms?.tiktok) || hasEvidenceType(t, "tiktok")).length;
  const withLinktree = targets.filter((t) => Boolean(t.platforms?.linktree) || hasEvidenceType(t, "linktree")).length;
  const withPhone = targets.filter(hasPhoneEvidence).length;
  const withEmail = targets.filter(hasEmailEvidence).length;
  const resolved = targets.filter((t) => (t.resolutionStatus ?? "unknown") === "resolved").length;
  const partial = targets.filter((t) => (t.resolutionStatus ?? "unknown") === "partial").length;
  const unknown = targets.filter((t) => (t.resolutionStatus ?? "unknown") === "unknown").length;
  const conflict = targets.filter((t) => (t.resolutionStatus ?? "unknown") === "conflict").length;
  const multiSignal = targets.filter((t) => (t.evidence ?? []).length >= 3).length;
  const confidenceValues = targets.map((t) => normalizeConfidence(t.confidenceScore)).filter((v): v is number => v !== null);
  const avgConfidence = confidenceValues.length
    ? Number((confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length).toFixed(2))
    : 0;
  return {
    totalTargets,
    withWebsite,
    withInstagram,
    withTikTok,
    withLinktree,
    withPhone,
    withEmail,
    resolved,
    partial,
    unknown,
    conflict,
    avgConfidence,
    multiSignal,
  };
}

export function compareSocialTargetMetrics(
  baseline: SocialTargetMetrics,
  current: SocialTargetMetrics
): SocialTargetMetricsCompare {
  const keys = Object.keys(current) as Array<keyof SocialTargetMetrics>;
  const delta = {} as Record<keyof SocialTargetMetrics, number>;
  for (const key of keys) {
    delta[key] = Number((current[key] - baseline[key]).toFixed(2));
  }
  return { baseline, current, delta };
}
