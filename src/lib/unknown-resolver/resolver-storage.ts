import type {
  BestContactMethod,
  ContactConfidence,
  OutreachStatus,
  ResolverDecision,
  UnknownResolverRecord,
} from "./resolver-types";
import { applyContactEnrichmentDerivation } from "./resolver-contact-readiness";
import { scoreHouseCleaningRecord } from "./resolver-score";
import { HOUSE_CLEANING_CANDIDATES_BY_RECORD } from "@/lib/mock/unknownResolver/houseCleaningCandidates";
import { HOUSE_CLEANING_QUEUE_SEED } from "@/lib/mock/unknownResolver/houseCleaningQueue";

let queueOverride: UnknownResolverRecord[] | null = null;

function materializeQueue(): UnknownResolverRecord[] {
  return queueOverride ?? [...HOUSE_CLEANING_QUEUE_SEED];
}

/** Future: Firestore / API. For v1 returns in-memory or seed. */
export function loadUnknownResolverQueue(): UnknownResolverRecord[] {
  return materializeQueue();
}

export function loadUnknownResolverCandidates(recordId: string) {
  return [...(HOUSE_CLEANING_CANDIDATES_BY_RECORD[recordId] ?? [])];
}

/** Promoted rows only (downstream outreach). */
export function loadOutreachQueue(): UnknownResolverRecord[] {
  return loadUnknownResolverQueue().filter((r) => r.promotedAt != null);
}

/**
 * Persist scoring snapshot for records missing lastScoredAt.
 * Call once after load (e.g. client mount) so systemScore / recommendation / reasoning are stable.
 */
export function hydrateQueueScores(): void {
  const q = materializeQueue();
  const now = new Date().toISOString();
  let changed = false;
  const next = q.map((r) => {
    if (r.lastScoredAt != null) return r;
    const cands = loadUnknownResolverCandidates(r.id);
    const bd = scoreHouseCleaningRecord(r, cands);
    changed = true;
    return {
      ...r,
      systemScore: bd.finalScore,
      systemRecommendation: bd.recommendation,
      scoreReasoning: bd.reasoning,
      lastScoredAt: now,
      updatedAt: now,
    };
  });
  if (changed) {
    queueOverride = next;
  }
}

/** Persist operator decision; does not re-run scoring. */
export function saveOperatorDecision(
  recordId: string,
  decision: ResolverDecision,
  note: string | null
): UnknownResolverRecord | null {
  const q = materializeQueue();
  const idx = q.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  const t = new Date().toISOString();
  const updated: UnknownResolverRecord = {
    ...q[idx],
    operatorDecision: decision,
    operatorNote: note?.trim() || null,
    status: "reviewed",
    updatedAt: t,
  };
  const next = [...q];
  next[idx] = updated;
  queueOverride = next;
  return updated;
}

export type PromoteToOutreachInput = {
  outreachTags: string[];
  pitchLabel: string | null;
};

/**
 * Promote operator-yes record into outreach queue. Idempotent if already promoted.
 */
export function promoteToOutreach(recordId: string, input: PromoteToOutreachInput): UnknownResolverRecord | null {
  const q = materializeQueue();
  const idx = q.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  const cur = q[idx];
  if (cur.operatorDecision !== "yes") return null;
  if (cur.promotedAt != null) return cur;
  const t = new Date().toISOString();
  const outreachLabel = input.outreachTags.length > 0 ? input.outreachTags.join(" · ") : null;
  const base: UnknownResolverRecord = {
    ...cur,
    outreachStatus: "new",
    promotedAt: t,
    outreachTags: [...input.outreachTags],
    outreachLabel,
    pitchLabel: input.pitchLabel?.trim() || null,
    updatedAt: t,
  };
  const derived = applyContactEnrichmentDerivation(base);
  const updated: UnknownResolverRecord = { ...base, ...derived, lastEnrichedAt: null };
  const next = [...q];
  next[idx] = updated;
  queueOverride = next;
  return updated;
}

function emptyToNull(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** Empty or whitespace patch falls back to derived template. */
function overlayOptionalText(
  patch: string | null | undefined,
  derived: string | null
): string | null {
  if (patch === undefined) return derived;
  const t = patch?.trim();
  return t ? t : derived;
}

export type ContactEnrichmentPatch = {
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  bookingUrl?: string | null;
  instagramHandle?: string | null;
  facebookUrl?: string | null;
  contactConfidence?: ContactConfidence | null;
  bestContactMethod?: BestContactMethod;
  contactSource?: string | null;
  /** Optional overrides after derivation (operator-edited templates). */
  firstTouchPlan?: string | null;
  phoneScript?: string | null;
  dmScript?: string | null;
  emailScript?: string | null;
};

/**
 * Save contact fields + recompute first-touch plan, scripts, readiness, lastEnrichedAt.
 * Script/plan fields in patch override derived values when provided.
 */
export function saveContactEnrichment(recordId: string, patch: ContactEnrichmentPatch): UnknownResolverRecord | null {
  const q = materializeQueue();
  const idx = q.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  const cur = q[idx];
  if (cur.promotedAt == null) return null;
  const t = new Date().toISOString();
  const merged: UnknownResolverRecord = {
    ...cur,
    phone: patch.phone !== undefined ? emptyToNull(patch.phone) : cur.phone,
    email: patch.email !== undefined ? emptyToNull(patch.email) : cur.email,
    websiteUrl: patch.websiteUrl !== undefined ? emptyToNull(patch.websiteUrl) : cur.websiteUrl,
    bookingUrl: patch.bookingUrl !== undefined ? emptyToNull(patch.bookingUrl) : cur.bookingUrl,
    instagramHandle: patch.instagramHandle !== undefined ? emptyToNull(patch.instagramHandle) : cur.instagramHandle,
    facebookUrl: patch.facebookUrl !== undefined ? emptyToNull(patch.facebookUrl) : cur.facebookUrl,
    contactConfidence: patch.contactConfidence !== undefined ? patch.contactConfidence : cur.contactConfidence,
    bestContactMethod: patch.bestContactMethod ?? cur.bestContactMethod,
    contactSource: patch.contactSource !== undefined ? emptyToNull(patch.contactSource) : cur.contactSource,
    updatedAt: t,
  };
  const derived = applyContactEnrichmentDerivation(merged);
  const updated: UnknownResolverRecord = {
    ...merged,
    ...derived,
    firstTouchPlan: overlayOptionalText(patch.firstTouchPlan, derived.firstTouchPlan),
    phoneScript: overlayOptionalText(patch.phoneScript, derived.phoneScript),
    dmScript: overlayOptionalText(patch.dmScript, derived.dmScript),
    emailScript: overlayOptionalText(patch.emailScript, derived.emailScript),
    lastEnrichedAt: t,
  };
  const next = [...q];
  next[idx] = updated;
  queueOverride = next;
  return updated;
}

export type OutreachPatch = {
  outreachStatus?: OutreachStatus;
  outreachTags?: string[];
  outreachLabel?: string | null;
  pitchLabel?: string | null;
  operatorNote?: string | null;
};

/** Update outreach fields on a promoted record (e.g. outreach queue console). */
export function saveOutreachRecordPatch(recordId: string, patch: OutreachPatch): UnknownResolverRecord | null {
  const q = materializeQueue();
  const idx = q.findIndex((r) => r.id === recordId);
  if (idx < 0) return null;
  const cur = q[idx];
  if (cur.promotedAt == null) return null;
  const t = new Date().toISOString();
  const nextTags = patch.outreachTags != null ? [...patch.outreachTags] : cur.outreachTags;
  let outreachLabel: string | null = cur.outreachLabel;
  if (patch.outreachLabel !== undefined) {
    outreachLabel = patch.outreachLabel;
  } else if (patch.outreachTags != null) {
    outreachLabel = nextTags.length > 0 ? nextTags.join(" · ") : null;
  }
  const updated: UnknownResolverRecord = {
    ...cur,
    outreachStatus: patch.outreachStatus ?? cur.outreachStatus,
    outreachTags: nextTags,
    outreachLabel,
    pitchLabel: patch.pitchLabel !== undefined ? patch.pitchLabel : cur.pitchLabel,
    operatorNote: patch.operatorNote !== undefined ? patch.operatorNote : cur.operatorNote,
    updatedAt: t,
  };
  const next = [...q];
  next[idx] = updated;
  queueOverride = next;
  return updated;
}

/** Test / reset helper */
export function resetUnknownResolverQueueForTests(): void {
  queueOverride = null;
}
