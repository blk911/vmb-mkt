import { NextResponse } from "next/server";
import { parseSocialCandidate } from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget, parseSocialProfile } from "@/lib/social-targets/normalization";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import type {
  ActivitySignal,
  ProfileHealth,
  SocialEvidenceItem,
  SocialEvidencePlatform,
  SocialEvidenceType,
  SocialResolutionStatus,
  SocialCandidate,
  SocialTarget,
  SocialTargetBooking,
  SocialTargetStatus,
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
  "directory",
  "other",
];
const EVIDENCE_PLATFORMS: SocialEvidencePlatform[] = ["instagram", "tiktok", "linktree", "website"];
const EVIDENCE_CONFIDENCE = ["high", "medium", "low"] as const;
const RESOLUTION_STATUS: SocialResolutionStatus[] = ["resolved", "partial", "unknown", "conflict"];
const RUN_TYPE = ["validation", "scale", "adhoc"] as const;

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
  return item;
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
  if (typeof o.runId === "string" && o.runId.trim()) row.runId = o.runId.trim();
  if (typeof o.runType === "string" && RUN_TYPE.includes(o.runType as (typeof RUN_TYPE)[number])) {
    row.runType = o.runType as "validation" | "scale" | "adhoc";
  }
  if (typeof o.sourceVersion === "string" && o.sourceVersion.trim()) row.sourceVersion = o.sourceVersion.trim();
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
