import {
  applyVerificationToCandidate,
  ensureSocialCandidates,
  getPrimaryCandidate,
  patchCandidate,
  setPrimaryCandidateId,
} from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import { verifySocialCandidate } from "@/lib/social-targets/social-verification";
import {
  evaluateCandidateVerificationLadder,
  isCandidateStaleForRevalidation,
  pickBestFeaturedReplacement,
  type CandidateVerificationLadderResult,
} from "@/lib/social-targets/verification-ladder";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

export type RevalidateMode = "featured" | "all" | "selected" | "stale";

export type CandidateRevalidationOutcome = {
  candidateId: string;
  ladder: CandidateVerificationLadderResult;
};

export type TargetRevalidationOutcome = {
  targetId: string;
  featuredCandidateIdBefore?: string | null;
  featuredCandidateIdAfter?: string | null;
  candidateOutcomes: CandidateRevalidationOutcome[];
};

type RevalidateOptions = {
  mode: RevalidateMode;
  candidateIds?: string[];
  nowMs?: number;
};

function appendUnique(parts: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join(" | ");
}

function candidateLadderPatch(
  candidate: SocialCandidate,
  ladder: CandidateVerificationLadderResult
): Partial<SocialCandidate> {
  const noteBits = [
    candidate.notes ?? "",
    `revalidation:${ladder.featuredDecision}`,
    `identity:${ladder.identityMatchState}`,
    `territory:${ladder.territoryState}`,
    `resolve:${ladder.resolveState}`,
    ...ladder.reasons,
  ];
  const evidence = [...(candidate.evidence ?? []), ...ladder.reasons, `Ladder decision: ${ladder.featuredDecision}`].slice(-16);
  const patch: Partial<SocialCandidate> = {
    notes: appendUnique(noteBits),
    evidence,
    lastCheckedAt: ladder.checkedAt,
    resolveStatus: ladder.resolveState,
    activityStatus: ladder.activityState === "inactive" ? "stale" : ladder.activityState === "recent" ? "recent" : "unknown",
  };
  if (ladder.featuredDecision === "suppress") {
    patch.visibilityState = "hide";
    patch.verificationStatus = "rejected";
  } else if (ladder.featuredDecision === "review" || ladder.featuredDecision === "demote") {
    patch.visibilityState = "review";
    if (candidate.verificationStatus === "auto_verified" || candidate.verificationStatus === "manual_verified") {
      patch.verificationStatus = "candidate";
    }
  }
  return patch;
}

function pickCandidatesForMode(target: SocialTarget, options: RevalidateOptions): SocialCandidate[] {
  const ensured = ensureSocialCandidates(target);
  const candidates = ensured.socialCandidates ?? [];
  if (options.mode === "all") return candidates;
  if (options.mode === "featured") {
    const featured = getPrimaryCandidate(ensured);
    return featured ? [featured] : [];
  }
  if (options.mode === "stale") {
    const nowMs = options.nowMs ?? Date.now();
    return candidates.filter((c) => isCandidateStaleForRevalidation(c, nowMs));
  }
  if (options.mode === "selected") {
    const wanted = new Set((options.candidateIds ?? []).filter(Boolean));
    return candidates.filter((c) => wanted.has(c.id));
  }
  return candidates;
}

export async function revalidateTargetCandidates(
  target: SocialTarget,
  options: RevalidateOptions
): Promise<{ target: SocialTarget; outcome: TargetRevalidationOutcome }> {
  const nowMs = options.nowMs ?? Date.now();
  let next = normalizeSocialTarget(target);
  next = ensureSocialCandidates(next);
  const featuredBefore = next.primaryCandidateId ?? getPrimaryCandidate(next)?.id ?? null;
  const selected = pickCandidatesForMode(next, options);
  const candidateOutcomes: CandidateRevalidationOutcome[] = [];
  if (!selected.length) {
    return {
      target: next,
      outcome: {
        targetId: target.id,
        featuredCandidateIdBefore: featuredBefore,
        featuredCandidateIdAfter: next.primaryCandidateId ?? featuredBefore,
        candidateOutcomes,
      },
    };
  }

  for (const originalCandidate of selected) {
    const verification = await verifySocialCandidate(originalCandidate);
    next = normalizeSocialTarget(applyVerificationToCandidate(next, originalCandidate.id, verification, { autoVerify: true }));
    const refreshed = (ensureSocialCandidates(next).socialCandidates ?? []).find((c) => c.id === originalCandidate.id);
    if (!refreshed) continue;
    const alternatives = (next.socialCandidates ?? []).filter((c) => c.id !== refreshed.id);
    const ladder = evaluateCandidateVerificationLadder(next, refreshed, {
      verification,
      alternatives,
      nowMs,
      asFeatured: featuredBefore === refreshed.id,
    });
    const patch = candidateLadderPatch(refreshed, ladder);
    next = normalizeSocialTarget(patchCandidate(next, refreshed.id, patch));
    candidateOutcomes.push({ candidateId: refreshed.id, ladder });
  }

  const ensured = ensureSocialCandidates(next);
  const featuredAfterVerify = ensured.primaryCandidateId ?? getPrimaryCandidate(ensured)?.id ?? null;
  const featuredCandidate =
    featuredAfterVerify && (ensured.socialCandidates ?? []).find((c) => c.id === featuredAfterVerify);
  if (featuredCandidate) {
    const featuredLadder = evaluateCandidateVerificationLadder(ensured, featuredCandidate, {
      alternatives: (ensured.socialCandidates ?? []).filter((c) => c.id !== featuredCandidate.id),
      nowMs,
      asFeatured: true,
    });
    if (featuredLadder.featuredDecision === "replace_if_better_alternate_exists") {
      const replacement = pickBestFeaturedReplacement(ensured, ensured.socialCandidates ?? [], nowMs);
      if (replacement && replacement !== featuredCandidate.id) {
        next = normalizeSocialTarget(setPrimaryCandidateId(ensured, replacement));
      }
    }
  }

  const featuredAfter = next.primaryCandidateId ?? getPrimaryCandidate(next)?.id ?? null;
  return {
    target: next,
    outcome: {
      targetId: target.id,
      featuredCandidateIdBefore: featuredBefore,
      featuredCandidateIdAfter: featuredAfter,
      candidateOutcomes,
    },
  };
}
