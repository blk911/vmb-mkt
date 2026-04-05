import type { SourceCandidateInput, SourceLiveHint, SourceTrustTier } from "@/lib/social-targets/source-adapters/types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function pickBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

export function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      const list = value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
      if (list.length) return list;
    }
  }
  return undefined;
}

export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || undefined;
}

export function normalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export function extractDomain(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(normalizeUrl(raw) ?? raw);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeLiveHint(raw?: string): SourceLiveHint | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "live") return "live";
  if (s === "dead" || s === "not_found" || s === "gone") return "dead";
  if (s === "blocked" || s === "redirect" || s === "unknown" || s === "stale") return "unknown";
  return undefined;
}

export function compactEvidence(items: Array<string | undefined | null>): string[] | undefined {
  const out = items.map((x) => (x ?? "").trim()).filter((x) => x.length > 0);
  return out.length ? out : undefined;
}

export function stripAt(handle?: string): string | undefined {
  if (!handle) return undefined;
  const clean = handle.trim().replace(/^@/, "");
  return clean || undefined;
}

export function createBaseCandidate(args: {
  sourceType: SourceCandidateInput["sourceType"];
  sourceTrustTier: SourceTrustTier;
  sourceLabel?: string;
  sourceUrl?: string;
  rawSourceId?: string;
}): SourceCandidateInput {
  return {
    sourceType: args.sourceType,
    sourceTrustTier: args.sourceTrustTier,
    sourceLabel: args.sourceLabel,
    sourceUrl: normalizeUrl(args.sourceUrl),
    rawSourceId: args.rawSourceId,
    liveHint: "unknown",
  };
}

