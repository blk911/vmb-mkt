import { extractDomain, normalizePhone } from "@/lib/social-targets/source-adapters/shared";
import { detectPlatformFromUrl, extractHandle } from "@/lib/social-targets/social-normalization";
import type {
  AddressExpansionAggregatorType,
  SocialEvidenceConfidence,
  SocialEvidenceItem,
  SocialEvidencePlatform,
  SocialEvidenceType,
  SocialResolutionStatus,
  SocialTarget,
} from "@/types/social-target";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.round(clamp(n, lo, hi));
}

function normalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function asConfidence(value: unknown): SocialEvidenceConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function asEvidenceType(value: unknown): SocialEvidenceType {
  if (
    value === "instagram" ||
    value === "tiktok" ||
    value === "linktree" ||
    value === "website" ||
    value === "website_social" ||
    value === "phone_lookup" ||
    value === "address_lookup" ||
    value === "booking_platform" ||
    value === "directory_expansion" ||
    value === "address_businesses" ||
    value === "aggregator_site" ||
    value === "suite_operator" ||
    value === "directory" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function asDomainType(value: unknown): SocialEvidenceItem["domainType"] {
  if (
    value === "booking_platform" ||
    value === "directory" ||
    value === "aggregator_site" ||
    value === "social_platform" ||
    value === "website" ||
    value === "other"
  ) {
    return value;
  }
  return undefined;
}

function sanitizeEvidenceItem(raw: SocialEvidenceItem): SocialEvidenceItem {
  const type = asEvidenceType(raw.type);
  const platform =
    raw.platform === "instagram" || raw.platform === "tiktok" || raw.platform === "linktree" || raw.platform === "website"
      ? raw.platform
      : platformFromEvidenceType(type);
  const url = normalizeUrl(raw.url);
  const sourceQuery = typeof raw.sourceQuery === "string" && raw.sourceQuery.trim() ? raw.sourceQuery.trim() : "unknown query";
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim()
      ? raw.createdAt
      : new Date().toISOString();
  const nameSimilarity =
    typeof raw.matchSignals?.nameSimilarity === "number" && Number.isFinite(raw.matchSignals.nameSimilarity)
      ? clamp(raw.matchSignals.nameSimilarity, 0, 1)
      : 0;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `ev-${shortHash(`${type}|${url ?? ""}|${sourceQuery}`)}`,
    type,
    ...(platform ? { platform } : {}),
    ...(url ? { url } : {}),
    ...(typeof raw.title === "string" && raw.title.trim() ? { title: raw.title.trim() } : {}),
    ...(typeof raw.snippet === "string" && raw.snippet.trim() ? { snippet: raw.snippet.trim() } : {}),
    ...(typeof raw.addressLink === "string" && raw.addressLink.trim() ? { addressLink: raw.addressLink.trim() } : {}),
    sourceQuery,
    confidence: asConfidence(raw.confidence),
    ...(asDomainType(raw.domainType) ? { domainType: asDomainType(raw.domainType) } : {}),
    matchSignals: {
      nameSimilarity,
      geoMatch: raw.matchSignals?.geoMatch === true,
      ...(typeof raw.matchSignals?.phoneMatch === "boolean" ? { phoneMatch: raw.matchSignals.phoneMatch } : {}),
      ...(typeof raw.matchSignals?.domainMatch === "boolean" ? { domainMatch: raw.matchSignals.domainMatch } : {}),
    },
    extracted: {
      ...(typeof raw.extracted?.phone === "string" && raw.extracted.phone.trim() ? { phone: raw.extracted.phone.trim() } : {}),
      ...(typeof raw.extracted?.email === "string" && raw.extracted.email.trim() ? { email: raw.extracted.email.trim() } : {}),
      ...(typeof raw.extracted?.handle === "string" && raw.extracted.handle.trim()
        ? { handle: raw.extracted.handle.trim() }
        : {}),
    },
    createdAt,
  };
}

export function classifyEvidenceTypeFromUrl(url?: string): SocialEvidenceType {
  if (!url) return "other";
  const u = url.toLowerCase();
  if (isBookingPlatformUrl(u)) return "booking_platform";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("linktr.ee")) return "linktree";
  if (u.includes("solasalons.com") || u.includes("phenixsalonsuites.com") || u.includes("salonsbyjc.com")) {
    return "aggregator_site";
  }
  if (u.includes("yelp.com")) return "directory_expansion";
  if (u.includes("maps.google")) return "directory";
  if (u.includes("/social") || u.includes("/instagram") || u.includes("/tiktok")) return "website_social";
  if (/^https?:\/\//i.test(u)) return "website";
  return "other";
}

export function platformFromEvidenceType(type: SocialEvidenceType): SocialEvidencePlatform | undefined {
  if (type === "instagram") return "instagram";
  if (type === "tiktok") return "tiktok";
  if (type === "linktree") return "linktree";
  if (type === "website" || type === "website_social") return "website";
  return undefined;
}

const BOOKING_HOST_PATTERNS = [
  "glossgenius.com",
  "vagaro.com",
  "styleseat.com",
  "booksy.com",
  "fresha.com",
  "square.site",
  "squareup.com",
] as const;

const DIRECTORY_HOST_PATTERNS = ["yelp.com", "mapquest.com", "yellowpages.com"] as const;

const AGGREGATOR_HOST_PATTERNS = [
  "solasalons.com",
  "phenixsalonsuites.com",
  "salonsbyjc.com",
  "mysalonsuite.com",
  "imagestudios360.com",
  "spectrasalonstudios.com",
] as const;

function hostForUrl(url?: string): string {
  if (!url) return "";
  try {
    return new URL(normalizeUrl(url) ?? url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

export function isBookingPlatformUrl(url?: string): boolean {
  const host = hostForUrl(url);
  if (!host) return false;
  return hostMatches(host, BOOKING_HOST_PATTERNS);
}

export function isDirectoryUrl(url?: string): boolean {
  const host = hostForUrl(url);
  if (!host) return false;
  return hostMatches(host, DIRECTORY_HOST_PATTERNS);
}

export function detectAggregatorTypeFromText(input?: string): AddressExpansionAggregatorType | undefined {
  const value = (input ?? "").toLowerCase();
  if (!value) return undefined;
  if (value.includes("sola")) return "sola";
  if (value.includes("phenix")) return "phenix";
  if (value.includes("salons by jc") || value.includes("salonsbyjc")) return "salons_by_jc";
  if (value.includes("mysalon") || value.includes("my salon suite")) return "mysalon_suite";
  if (value.includes("image studios") || value.includes("imagestudios")) return "image_studios";
  if (value.includes("spectra")) return "spectra";
  if (value.includes("suite")) return "other";
  return undefined;
}

export function domainTypeForUrl(url?: string): NonNullable<SocialEvidenceItem["domainType"]> {
  if (!url) return "other";
  if (isBookingPlatformUrl(url)) return "booking_platform";
  if (isDirectoryUrl(url)) return "directory";
  const host = hostForUrl(url);
  if (hostMatches(host, AGGREGATOR_HOST_PATTERNS)) return "aggregator_site";
  const social = detectPlatformFromUrl(url);
  if (social === "instagram" || social === "tiktok" || social === "linktree") return "social_platform";
  if (/^https?:\/\//i.test(url.trim())) return "website";
  return "other";
}

export function extractOperatorNameFromResult(title?: string, snippet?: string): string | undefined {
  const source = [title, snippet].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(" | ");
  if (!source) return undefined;
  const cleaned = source
    .replace(/\s+/g, " ")
    .replace(/\([^)]+\)/g, "")
    .replace(/\s*[|\-•·]\s*(Instagram|TikTok|Linktree|Vagaro|StyleSeat|Booksy|GlossGenius|Fresha).*$/i, "")
    .trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 96);
}

export function extractHandleFromUrl(url?: string, platform?: SocialEvidencePlatform): string | undefined {
  if (!url) return undefined;
  const detected = platform ?? (detectPlatformFromUrl(url) as SocialEvidencePlatform);
  if (!detected) return undefined;
  return extractHandle(detected, url);
}

export function confidenceToScore(confidence: SocialEvidenceConfidence): number {
  if (confidence === "high") return 90;
  if (confidence === "medium") return 65;
  return 40;
}

export function scoreToConfidence(score: number): SocialEvidenceConfidence {
  if (score >= 78) return "high";
  if (score >= 54) return "medium";
  return "low";
}

export function computeConfidenceScore(target: Pick<SocialTarget, "evidence">): number {
  const evidence = Array.isArray(target.evidence) ? target.evidence : [];
  if (!evidence.length) return 0;
  const avgSignal =
    evidence.reduce((sum, ev) => {
      const base = confidenceToScore(ev.confidence);
      const nameBonus = clamp(ev.matchSignals.nameSimilarity, 0, 1) * 25;
      const geoBonus = ev.matchSignals.geoMatch ? 10 : 0;
      const phoneBonus = ev.matchSignals.phoneMatch ? 8 : 0;
      const domainBonus = ev.matchSignals.domainMatch ? 8 : 0;
      const platformBonus = ev.platform === "instagram" || ev.platform === "tiktok" || ev.platform === "linktree" ? 6 : 0;
      const bookingBonus = ev.type === "booking_platform" || ev.domainType === "booking_platform" ? 5 : 0;
      const suiteBonus = ev.type === "suite_operator" || ev.type === "aggregator_site" ? 4 : 0;
      return sum + base + nameBonus + geoBonus + phoneBonus + domainBonus + platformBonus + bookingBonus + suiteBonus;
    }, 0) / evidence.length;
  const countBonus = Math.min(12, Math.max(0, evidence.length - 1) * 2);
  return clampInt(avgSignal + countBonus, 0, 100);
}

export function deriveResolutionStatus(target: Pick<SocialTarget, "evidence" | "confidenceScore">): SocialResolutionStatus {
  const evidence = Array.isArray(target.evidence) ? target.evidence : [];
  if (!evidence.length) return "unknown";
  const score = typeof target.confidenceScore === "number" ? target.confidenceScore : computeConfidenceScore(target);
  const highCount = evidence.filter((ev) => ev.confidence === "high").length;
  const knownPlatforms = new Set(
    evidence
      .map((ev) => ev.platform)
      .filter((p): p is NonNullable<SocialEvidenceItem["platform"]> => Boolean(p))
  );
  const hasConflict = evidence.some((ev) => ev.matchSignals.geoMatch === false && ev.matchSignals.nameSimilarity > 0.75);
  if (hasConflict && highCount >= 2) return "conflict";
  if (score >= 75 && (highCount >= 1 || knownPlatforms.size >= 2) && evidence.length >= 2) return "resolved";
  if (score >= 45) return "partial";
  return "unknown";
}

function evidenceIdentityKey(item: SocialEvidenceItem): string {
  const normalizedUrl = normalizeUrl(item.url)?.toLowerCase() ?? "";
  return [item.type, item.platform ?? "", normalizedUrl, item.sourceQuery.trim().toLowerCase()].join("|");
}

export function mergeEvidenceItems(
  existing: SocialEvidenceItem[] | undefined,
  additions: SocialEvidenceItem[]
): SocialEvidenceItem[] {
  const out: SocialEvidenceItem[] = [];
  const byKey = new Map<string, SocialEvidenceItem>();
  for (const item of [...(existing ?? []), ...additions]) {
    const key = evidenceIdentityKey(item);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      continue;
    }
    const bestConfidence =
      confidenceToScore(item.confidence) >= confidenceToScore(prev.confidence) ? item.confidence : prev.confidence;
    byKey.set(key, {
      ...prev,
      ...item,
      confidence: bestConfidence,
      title: item.title || prev.title,
      snippet: item.snippet || prev.snippet,
      extracted: {
        ...prev.extracted,
        ...item.extracted,
      },
      matchSignals: {
        nameSimilarity: Math.max(prev.matchSignals.nameSimilarity, item.matchSignals.nameSimilarity),
        geoMatch: prev.matchSignals.geoMatch || item.matchSignals.geoMatch,
        phoneMatch: prev.matchSignals.phoneMatch || item.matchSignals.phoneMatch,
        domainMatch: prev.matchSignals.domainMatch || item.matchSignals.domainMatch,
      },
    });
  }
  for (const item of byKey.values()) out.push(item);
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

export function derivePlatformsFromEvidence(evidence: SocialEvidenceItem[]): NonNullable<SocialTarget["platforms"]> {
  const pickBest = (platform: SocialEvidencePlatform): string | undefined => {
    const candidates = evidence
      .filter((ev) => ev.platform === platform || ev.type === platform)
      .sort((a, b) => confidenceToScore(b.confidence) - confidenceToScore(a.confidence));
    if (!candidates.length) return undefined;
    const strong = candidates.find((c) => c.confidence === "high") ?? candidates[0];
    if (confidenceToScore(strong.confidence) < 54) return undefined;
    return strong.url;
  };
  return {
    instagram: pickBest("instagram"),
    tiktok: pickBest("tiktok"),
    linktree: pickBest("linktree"),
  };
}

export function createEvidenceItem(input: {
  type: SocialEvidenceType;
  platform?: SocialEvidencePlatform;
  url?: string;
  title?: string;
  snippet?: string;
  sourceQuery: string;
  confidence: SocialEvidenceConfidence;
  nameSimilarity: number;
  geoMatch: boolean;
  phoneMatch?: boolean;
  domainMatch?: boolean;
  phone?: string;
  email?: string;
  handle?: string;
  createdAt?: string;
  addressLink?: string;
  domainType?: SocialEvidenceItem["domainType"];
}): SocialEvidenceItem {
  const normalizedUrl = normalizeUrl(input.url);
  const type = input.type;
  const platform = input.platform ?? platformFromEvidenceType(type);
  const sourceQuery = input.sourceQuery.trim();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const handle = input.handle ?? extractHandleFromUrl(normalizedUrl, platform);
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim();
  const idSeed = `${type}|${platform ?? ""}|${normalizedUrl ?? ""}|${sourceQuery}|${createdAt}`;
  return {
    id: `ev-${shortHash(idSeed)}`,
    type,
    platform,
    ...(normalizedUrl ? { url: normalizedUrl } : {}),
    ...(input.title ? { title: input.title.trim() } : {}),
    ...(input.snippet ? { snippet: input.snippet.trim() } : {}),
    ...(input.addressLink ? { addressLink: input.addressLink.trim() } : {}),
    ...(input.domainType ? { domainType: input.domainType } : normalizedUrl ? { domainType: domainTypeForUrl(normalizedUrl) } : {}),
    sourceQuery,
    confidence: input.confidence,
    matchSignals: {
      nameSimilarity: clamp(input.nameSimilarity, 0, 1),
      geoMatch: input.geoMatch,
      ...(typeof input.phoneMatch === "boolean" ? { phoneMatch: input.phoneMatch } : {}),
      ...(typeof input.domainMatch === "boolean" ? { domainMatch: input.domainMatch } : {}),
    },
    extracted: {
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(handle ? { handle } : {}),
    },
    createdAt,
  };
}

export function normalizeSocialTargetRecord(target: SocialTarget): SocialTarget {
  const evidence = Array.isArray(target.evidence) ? target.evidence.map(sanitizeEvidenceItem) : [];
  const mergedEvidence = mergeEvidenceItems([], evidence);
  const safeAddressExpansion =
    target.addressExpansion && typeof target.addressExpansion === "object"
      ? {
          ...target.addressExpansion,
          ...(Array.isArray(target.addressExpansion.candidates)
            ? {
                candidates: target.addressExpansion.candidates
                  .filter((candidate) => candidate && typeof candidate === "object" && typeof candidate.id === "string")
                  .map((candidate) => ({
                    ...candidate,
                    evidenceIds: Array.isArray(candidate.evidenceIds) ? candidate.evidenceIds.filter(Boolean) : [],
                  })),
              }
            : {}),
        }
      : undefined;
  const platforms = {
    ...(target.platforms ?? {}),
    ...derivePlatformsFromEvidence(mergedEvidence),
  };
  const confidenceScore =
    typeof target.confidenceScore === "number" && Number.isFinite(target.confidenceScore)
      ? clampInt(target.confidenceScore, 0, 100)
      : computeConfidenceScore({ evidence: mergedEvidence });
  const resolutionStatus =
    target.resolutionStatus ?? deriveResolutionStatus({ evidence: mergedEvidence, confidenceScore });
  return {
    ...target,
    evidence: mergedEvidence,
    platforms,
    confidenceScore,
    resolutionStatus,
    ...(safeAddressExpansion ? { addressExpansion: safeAddressExpansion } : {}),
  };
}

export function appendEvidenceToTarget(
  target: SocialTarget,
  additions: SocialEvidenceItem[],
  runMeta?: Pick<SocialTarget, "runId" | "runType" | "sourceVersion">
): SocialTarget {
  const mergedEvidence = mergeEvidenceItems(target.evidence, additions);
  const platforms = {
    ...(target.platforms ?? {}),
    ...derivePlatformsFromEvidence(mergedEvidence),
  };
  const confidenceScore = computeConfidenceScore({ evidence: mergedEvidence });
  const resolutionStatus = deriveResolutionStatus({ evidence: mergedEvidence, confidenceScore });
  return {
    ...target,
    evidence: mergedEvidence,
    platforms,
    confidenceScore,
    resolutionStatus,
    ...(runMeta?.runId ? { runId: runMeta.runId } : {}),
    ...(runMeta?.runType ? { runType: runMeta.runType } : {}),
    ...(runMeta?.sourceVersion ? { sourceVersion: runMeta.sourceVersion } : {}),
  };
}

export function nameSimilarityScore(anchorName: string | undefined, candidateTitle: string | undefined): number {
  const a = (anchorName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const b = (candidateTitle ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.86;
  let overlap = 0;
  const seen = new Set<string>();
  for (const ch of a) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    if (b.includes(ch)) overlap += 1;
  }
  return clamp(overlap / Math.max(1, seen.size), 0, 1);
}

export function domainMatch(anchorWebsite: string | undefined, resultUrl: string | undefined): boolean {
  const a = extractDomain(anchorWebsite);
  const b = extractDomain(resultUrl);
  if (!a || !b) return false;
  return a === b;
}
