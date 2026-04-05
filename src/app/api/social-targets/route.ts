import { NextResponse } from "next/server";
import { parseSocialCandidate } from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget, parseSocialProfile } from "@/lib/social-targets/normalization";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import type {
  ActivitySignal,
  AddressExpansionCandidate,
  AddressExpansionClassification,
  ProfileHealth,
  SocialEvidenceItem,
  SocialEvidencePlatform,
  SocialEvidenceType,
  SocialResolutionStatus,
  SocialCandidate,
  SocialTarget,
  SocialTargetBooking,
  SocialTargetStatus,
  VerificationState,
} from "@/types/social-target";

const STATUSES: SocialTargetStatus[] = ["new", "contacted", "qualified", "paused", "responded", "live"];
const PROFILE_HEALTH: ProfileHealth[] = ["active", "not_found", "renamed_or_moved", "stale", "private", "unknown"];
const ACTIVITY: ActivitySignal[] = ["hot", "warm", "cold", "unknown"];
const BOOKINGS: SocialTargetBooking[] = ["dm", "link", "phone"];
const EVIDENCE_TYPES: SocialEvidenceType[] = [
  "instagram",
  "tiktok",
  "linktree",
  "website",
  "website_social",
  "phone_lookup",
  "address_lookup",
  "booking_platform",
  "directory_expansion",
  "address_businesses",
  "aggregator_site",
  "suite_operator",
  "directory",
  "other",
];
const EVIDENCE_PLATFORMS: SocialEvidencePlatform[] = ["instagram", "tiktok", "linktree", "website"];
const EVIDENCE_CONFIDENCE = ["high", "medium", "low"] as const;
const RESOLUTION_STATUS: SocialResolutionStatus[] = ["resolved", "partial", "unknown", "conflict"];
const VERIFICATION_STATE: VerificationState[] = ["discovered", "matched", "unverified", "live_verified", "dead", "rejected"];
const RUN_TYPE = ["validation", "scale", "adhoc", "expansion_test"] as const;
const DOMAIN_TYPES = ["booking_platform", "directory", "aggregator_site", "social_platform", "website", "other"] as const;
const AGGREGATOR_TYPES = ["sola", "phenix", "salons_by_jc", "mysalon_suite", "image_studios", "spectra", "other"] as const;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseEvidence(raw: unknown): SocialEvidenceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.type) || !isNonEmptyString(o.sourceQuery) || !isNonEmptyString(o.createdAt)) {
    return null;
  }
  const type = o.type as SocialEvidenceType;
  if (!EVIDENCE_TYPES.includes(type)) return null;
  const confidence = o.confidence as (typeof EVIDENCE_CONFIDENCE)[number];
  if (!EVIDENCE_CONFIDENCE.includes(confidence)) return null;
  const matchSignalsRaw = o.matchSignals;
  if (!matchSignalsRaw || typeof matchSignalsRaw !== "object") return null;
  const ms = matchSignalsRaw as Record<string, unknown>;
  const nameSimilarity = typeof ms.nameSimilarity === "number" && Number.isFinite(ms.nameSimilarity) ? ms.nameSimilarity : 0;
  const geoMatch = ms.geoMatch === true;
  const extractedRaw = o.extracted;
  const extractedRecord = extractedRaw && typeof extractedRaw === "object" ? (extractedRaw as Record<string, unknown>) : {};
  const item: SocialEvidenceItem = {
    id: String(o.id).trim(),
    type,
    sourceQuery: String(o.sourceQuery).trim(),
    confidence,
    matchSignals: {
      nameSimilarity: Math.max(0, Math.min(1, nameSimilarity)),
      geoMatch,
      ...(typeof ms.phoneMatch === "boolean" ? { phoneMatch: ms.phoneMatch } : {}),
      ...(typeof ms.domainMatch === "boolean" ? { domainMatch: ms.domainMatch } : {}),
    },
    extracted: {
      ...(typeof extractedRecord.phone === "string" && extractedRecord.phone.trim()
        ? { phone: extractedRecord.phone.trim() }
        : {}),
      ...(typeof extractedRecord.email === "string" && extractedRecord.email.trim()
        ? { email: extractedRecord.email.trim() }
        : {}),
      ...(typeof extractedRecord.handle === "string" && extractedRecord.handle.trim()
        ? { handle: extractedRecord.handle.trim() }
        : {}),
    },
    createdAt: String(o.createdAt),
  };
  if (typeof o.platform === "string" && EVIDENCE_PLATFORMS.includes(o.platform as SocialEvidencePlatform)) {
    item.platform = o.platform as SocialEvidencePlatform;
  }
  if (typeof o.url === "string" && o.url.trim()) item.url = o.url.trim();
  if (typeof o.title === "string" && o.title.trim()) item.title = o.title.trim();
  if (typeof o.snippet === "string" && o.snippet.trim()) item.snippet = o.snippet.trim();
  if (typeof o.addressLink === "string" && o.addressLink.trim()) item.addressLink = o.addressLink.trim();
  if (typeof o.domainType === "string" && DOMAIN_TYPES.includes(o.domainType as (typeof DOMAIN_TYPES)[number])) {
    item.domainType = o.domainType as SocialEvidenceItem["domainType"];
  }
  return item;
}

function parseAddressExpansionClassification(raw: unknown): AddressExpansionClassification | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.isLikelyMultiTenant !== "boolean") return undefined;
  const addressDensityScore =
    typeof o.addressDensityScore === "number" && Number.isFinite(o.addressDensityScore)
      ? Math.max(0, Math.min(100, Math.round(o.addressDensityScore)))
      : 0;
  const expansionPriority =
    o.expansionPriority === "high" || o.expansionPriority === "medium" || o.expansionPriority === "low"
      ? o.expansionPriority
      : "low";
  const classification: AddressExpansionClassification = {
    isLikelyMultiTenant: o.isLikelyMultiTenant,
    addressDensityScore,
    expansionPriority,
  };
  if (typeof o.aggregatorType === "string" && AGGREGATOR_TYPES.includes(o.aggregatorType as (typeof AGGREGATOR_TYPES)[number])) {
    classification.aggregatorType = o.aggregatorType as AddressExpansionClassification["aggregatorType"];
  }
  return classification;
}

function parseAddressExpansionCandidate(raw: unknown): AddressExpansionCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.operatorName) || !isNonEmptyString(o.createdAt)) return null;
  const confidence = o.confidence;
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") return null;
  const evidenceIds = Array.isArray(o.evidenceIds)
    ? o.evidenceIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const candidate: AddressExpansionCandidate = {
    id: o.id.trim(),
    operatorName: o.operatorName.trim(),
    confidence,
    evidenceIds,
    discoveryMode: "address_expansion",
    createdAt: o.createdAt.trim(),
  };
  if (typeof o.platform === "string" && EVIDENCE_PLATFORMS.includes(o.platform as SocialEvidencePlatform)) {
    candidate.platform = o.platform as SocialEvidencePlatform;
  }
  if (typeof o.handle === "string" && o.handle.trim()) candidate.handle = o.handle.trim();
  if (typeof o.url === "string" && o.url.trim()) candidate.url = o.url.trim();
  if (typeof o.bookingUrl === "string" && o.bookingUrl.trim()) candidate.bookingUrl = o.bookingUrl.trim();
  if (typeof o.sourceAddress === "string" && o.sourceAddress.trim()) candidate.sourceAddress = o.sourceAddress.trim();
  if (typeof o.parentTargetId === "string" && o.parentTargetId.trim()) candidate.parentTargetId = o.parentTargetId.trim();
  if (typeof o.notes === "string" && o.notes.trim()) candidate.notes = o.notes.trim();
  if (o.prospect && typeof o.prospect === "object") {
    const p = o.prospect as Record<string, unknown>;
    const type =
      p.type === "operator" ||
      p.type === "booking_operator" ||
      p.type === "aggregator" ||
      p.type === "directory" ||
      p.type === "ambiguous"
        ? p.type
        : null;
    const tier = p.tier === "hot" || p.tier === "warm" || p.tier === "cold" || p.tier === "exclude" ? p.tier : null;
    const readinessScore =
      typeof p.readinessScore === "number" && Number.isFinite(p.readinessScore)
        ? Math.max(0, Math.min(100, Math.round(p.readinessScore)))
        : null;
    const addressMatchRaw = p.addressMatch;
    const addressMatch =
      addressMatchRaw && typeof addressMatchRaw === "object"
        ? (addressMatchRaw as Record<string, unknown>)
        : null;
    if (type && tier && readinessScore !== null && addressMatch) {
      candidate.prospect = {
        type,
        tier,
        readinessScore,
        addressMatch: {
          exactAddressMatch: addressMatch.exactAddressMatch === true,
          propertyMatch: addressMatch.propertyMatch === true,
          cityMatch: addressMatch.cityMatch === true,
          score:
            typeof addressMatch.score === "number" && Number.isFinite(addressMatch.score)
              ? Math.round(addressMatch.score)
              : 0,
        },
      };
    }
  }
  return candidate;
}

function normalizeTarget(raw: unknown): SocialTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.handle) || !isNonEmptyString(o.zone) || !isNonEmptyString(o.category)) {
    return null;
  }
  const status = o.status;
  const st: SocialTargetStatus =
    typeof status === "string" && STATUSES.includes(status as SocialTargetStatus) ? (status as SocialTargetStatus) : "new";
  const tags = Array.isArray(o.tags) ? o.tags.filter((x): x is string => typeof x === "string") : [];
  const row: SocialTarget = {
    id: o.id.trim(),
    handle: String(o.handle).trim(),
    zone: String(o.zone).trim(),
    category: String(o.category).trim(),
    status: st,
    tags,
  };
  if (typeof o.businessName === "string") row.businessName = o.businessName;
  if (typeof o.notes === "string") row.notes = o.notes;
  if (typeof o.booking === "string" && BOOKINGS.includes(o.booking as SocialTargetBooking)) {
    row.booking = o.booking as SocialTargetBooking;
  }
  if (typeof o.followers === "number" && Number.isFinite(o.followers) && o.followers >= 0) {
    row.followers = Math.floor(o.followers);
  }
  if (typeof o.profileHealth === "string" && PROFILE_HEALTH.includes(o.profileHealth as ProfileHealth)) {
    row.profileHealth = o.profileHealth as ProfileHealth;
  }
  if (typeof o.lastVerifiedAt === "string") row.lastVerifiedAt = o.lastVerifiedAt;
  if (typeof o.verificationNote === "string") row.verificationNote = o.verificationNote;
  if (typeof o.activitySignal === "string" && ACTIVITY.includes(o.activitySignal as ActivitySignal)) {
    row.activitySignal = o.activitySignal as ActivitySignal;
  }
  if (typeof o.priorityScore === "number" && Number.isFinite(o.priorityScore)) {
    row.priorityScore = Math.max(0, Math.min(100, Math.round(o.priorityScore)));
  }
  if (o.priorityScoreManual === true) row.priorityScoreManual = true;
  if (typeof o.outreachAngle === "string") row.outreachAngle = o.outreachAngle;
  if ("socialProfile" in o) {
    const sp = parseSocialProfile(o.socialProfile);
    if (sp) row.socialProfile = sp;
  }
  if (Array.isArray(o.socialCandidates)) {
    const parsed: SocialCandidate[] = [];
    for (const item of o.socialCandidates) {
      const c = parseSocialCandidate(item);
      if (c) parsed.push(c);
    }
    if (parsed.length) row.socialCandidates = parsed;
  }
  if (typeof o.primaryCandidateId === "string" && o.primaryCandidateId.trim()) {
    row.primaryCandidateId = o.primaryCandidateId.trim();
  }
  if (Array.isArray(o.evidence)) {
    const evidence = o.evidence.map(parseEvidence).filter((x): x is SocialEvidenceItem => x !== null);
    if (evidence.length) row.evidence = evidence;
  }
  if (o.platforms && typeof o.platforms === "object") {
    const p = o.platforms as Record<string, unknown>;
    row.platforms = {
      ...(typeof p.instagram === "string" && p.instagram.trim() ? { instagram: p.instagram.trim() } : {}),
      ...(typeof p.tiktok === "string" && p.tiktok.trim() ? { tiktok: p.tiktok.trim() } : {}),
      ...(typeof p.linktree === "string" && p.linktree.trim() ? { linktree: p.linktree.trim() } : {}),
    };
  }
  if (typeof o.confidenceScore === "number" && Number.isFinite(o.confidenceScore)) {
    row.confidenceScore = Math.max(0, Math.min(100, Math.round(o.confidenceScore)));
  }
  if (typeof o.resolutionStatus === "string" && RESOLUTION_STATUS.includes(o.resolutionStatus as SocialResolutionStatus)) {
    row.resolutionStatus = o.resolutionStatus as SocialResolutionStatus;
  }
  if (typeof o.verificationState === "string" && VERIFICATION_STATE.includes(o.verificationState as VerificationState)) {
    row.verificationState = o.verificationState as VerificationState;
  }
  if (typeof o.runId === "string" && o.runId.trim()) row.runId = o.runId.trim();
  if (typeof o.runType === "string" && RUN_TYPE.includes(o.runType as (typeof RUN_TYPE)[number])) {
    row.runType = o.runType as "validation" | "scale" | "adhoc" | "expansion_test";
  }
  if (typeof o.sourceVersion === "string" && o.sourceVersion.trim()) row.sourceVersion = o.sourceVersion.trim();
  if (typeof o.normalizedAddress === "string" && o.normalizedAddress.trim()) row.normalizedAddress = o.normalizedAddress.trim();
  if (o.addressExpansion && typeof o.addressExpansion === "object") {
    const ae = o.addressExpansion as Record<string, unknown>;
    const parsed = {
      ...(typeof ae.sourceAddress === "string" && ae.sourceAddress.trim() ? { sourceAddress: ae.sourceAddress.trim() } : {}),
      ...(typeof ae.normalizedAddress === "string" && ae.normalizedAddress.trim()
        ? { normalizedAddress: ae.normalizedAddress.trim() }
        : {}),
      ...(typeof ae.queryCount === "number" && Number.isFinite(ae.queryCount) ? { queryCount: Math.max(0, Math.round(ae.queryCount)) } : {}),
      ...(typeof ae.candidateCount === "number" && Number.isFinite(ae.candidateCount)
        ? { candidateCount: Math.max(0, Math.round(ae.candidateCount)) }
        : {}),
      ...(typeof ae.usableCandidateCount === "number" && Number.isFinite(ae.usableCandidateCount)
        ? { usableCandidateCount: Math.max(0, Math.round(ae.usableCandidateCount)) }
        : {}),
      ...(typeof ae.lastRunId === "string" && ae.lastRunId.trim() ? { lastRunId: ae.lastRunId.trim() } : {}),
      ...(typeof ae.lastRunType === "string" && RUN_TYPE.includes(ae.lastRunType as (typeof RUN_TYPE)[number])
        ? { lastRunType: ae.lastRunType as "validation" | "scale" | "adhoc" | "expansion_test" }
        : {}),
      ...(typeof ae.sourceVersion === "string" && ae.sourceVersion.trim() ? { sourceVersion: ae.sourceVersion.trim() } : {}),
      ...(typeof ae.updatedAt === "string" && ae.updatedAt.trim() ? { updatedAt: ae.updatedAt.trim() } : {}),
    };
    if (ae.prospectCounts && typeof ae.prospectCounts === "object") {
      const c = ae.prospectCounts as Record<string, unknown>;
      parsed.prospectCounts = {
        hot: typeof c.hot === "number" && Number.isFinite(c.hot) ? Math.max(0, Math.round(c.hot)) : 0,
        warm: typeof c.warm === "number" && Number.isFinite(c.warm) ? Math.max(0, Math.round(c.warm)) : 0,
        cold: typeof c.cold === "number" && Number.isFinite(c.cold) ? Math.max(0, Math.round(c.cold)) : 0,
        exclude: typeof c.exclude === "number" && Number.isFinite(c.exclude) ? Math.max(0, Math.round(c.exclude)) : 0,
      };
    }
    const classification = parseAddressExpansionClassification(ae.classification);
    const candidates = Array.isArray(ae.candidates)
      ? ae.candidates.map(parseAddressExpansionCandidate).filter((x): x is AddressExpansionCandidate => x !== null)
      : [];
    row.addressExpansion = {
      ...parsed,
      ...(classification ? { classification } : {}),
      ...(candidates.length ? { candidates } : {}),
    };
  }
  return normalizeSocialTarget(row);
}

export async function GET(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const targets = (await getMergedSocialTargets()).map(normalizeSocialTarget);
    return NextResponse.json({ ok: true as const, targets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("targets" in body)) {
      return NextResponse.json({ ok: false, error: "expected { targets: [] }" }, { status: 400 });
    }
    const arr = (body as { targets: unknown }).targets;
    if (!Array.isArray(arr)) {
      return NextResponse.json({ ok: false, error: "targets must be an array" }, { status: 400 });
    }
    const normalized: SocialTarget[] = [];
    for (const item of arr) {
      const t = normalizeTarget(item);
      if (!t) {
        return NextResponse.json(
          { ok: false, error: "each target needs id, handle, zone, category; status/tags normalized" },
          { status: 400 }
        );
      }
      normalized.push(t);
    }
    const count = await saveMergedSocialTargetsAsRuntime(normalized);
    return NextResponse.json({ ok: true as const, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
