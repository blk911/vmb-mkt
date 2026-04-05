import type {
  BatchIngestMode,
  BatchIngestPayload,
  BatchIngestResult,
  BatchIngestSummary,
} from "@/lib/social-targets/batch-ingest-types";
import {
  ingestSourceCandidateInputs,
  patchCandidate,
  sourceCandidateInputToSocialCandidate,
} from "@/lib/social-targets/social-candidate-logic";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

function candidateIdentityKey(c: SocialCandidate): string {
  const platform = c.platform || "unknown";
  const handle = (c.handle ?? "").trim().toLowerCase();
  const url = (c.url ?? "").trim().toLowerCase();
  return `${platform}|${handle}|${url}`;
}

function sourceIdentityKey(i: SourceCandidateInput): string {
  const platform = i.platform || "unknown";
  const handle = (i.handle ?? "").trim().toLowerCase();
  const url = (i.profileUrl ?? "").trim().toLowerCase();
  return `${platform}|${handle}|${url}`;
}

function shouldSuppressInput(input: SourceCandidateInput): { suppressed: boolean; reason?: string } {
  if (!input.businessName && !input.personName && !input.handle && !input.profileUrl && !input.website) {
    return { suppressed: true, reason: "missing_identity_fields" };
  }
  if (input.sourceType === "yelp" && input.sourceTrustTier === "tier3" && !input.territoryHint && !input.anchorHint) {
    return { suppressed: true, reason: "weak_tier3_no_territory_or_anchor_hint" };
  }
  if (input.liveHint === "dead") {
    return { suppressed: true, reason: "source_marked_dead" };
  }
  return { suppressed: false };
}

function findTargetIndex(targets: SocialTarget[], input: SourceCandidateInput, explicitTargetId?: string): number {
  if (explicitTargetId) return targets.findIndex((t) => t.id === explicitTargetId);
  if (input.rawSourceId) {
    const byId = targets.findIndex((t) => t.id === input.rawSourceId);
    if (byId !== -1) return byId;
  }
  const business = (input.businessName ?? "").trim().toLowerCase();
  const zone = (input.zone ?? "").trim().toLowerCase();
  const category = (input.category ?? "").trim().toLowerCase();
  if (business) {
    const exact = targets.findIndex((t) => {
      const bn = (t.businessName ?? "").trim().toLowerCase();
      if (!bn || bn !== business) return false;
      if (zone && t.zone.toLowerCase() !== zone) return false;
      if (category && t.category.toLowerCase() !== category) return false;
      return true;
    });
    if (exact !== -1) return exact;
  }
  if (input.handle) {
    const h = input.handle.replace(/^@/, "").toLowerCase();
    const byHandle = targets.findIndex((t) => t.handle.replace(/^@/, "").toLowerCase() === h);
    if (byHandle !== -1) return byHandle;
  }
  return -1;
}

function applyReviewSeedMetadata(
  candidate: SocialCandidate,
  input: SourceCandidateInput,
  batchLabel?: string
): SocialCandidate {
  const noteParts = [
    candidate.notes,
    "queueState:review_seeded",
    batchLabel ? `sourceBatchLabel:${batchLabel}` : undefined,
    `sourceProvenance:${input.sourceType}`,
    `sourceTrustTier:${input.sourceTrustTier}`,
  ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return {
    ...candidate,
    visibilityState: "review",
    notes: noteParts.join(" | "),
    evidence: [
      ...(candidate.evidence ?? []),
      ...(batchLabel ? [`Batch label: ${batchLabel}`] : []),
      `Review seeded from ${input.sourceType} (${input.sourceTrustTier})`,
    ],
  };
}

function countSummary(results: BatchIngestResult[]): BatchIngestSummary {
  const summary: BatchIngestSummary = {
    totalProcessed: results.length,
    attached: 0,
    createdReviewCandidate: 0,
    duplicates: 0,
    alreadyPresent: 0,
    suppressed: 0,
    rejected: 0,
    skipped: 0,
    errors: 0,
  };
  for (const r of results) {
    if (r.outcome === "attached") summary.attached += 1;
    else if (r.outcome === "created_review_candidate") summary.createdReviewCandidate += 1;
    else if (r.outcome === "duplicate") summary.duplicates += 1;
    else if (r.outcome === "already_present") summary.alreadyPresent += 1;
    else if (r.outcome === "suppressed") summary.suppressed += 1;
    else if (r.outcome === "rejected") summary.rejected += 1;
    else if (r.outcome === "skipped") summary.skipped += 1;
  }
  return summary;
}

export function batchIngestSourceCandidateInputs(
  targets: SocialTarget[],
  payload: BatchIngestPayload
): { targets: SocialTarget[]; results: BatchIngestResult[]; summary: BatchIngestSummary } {
  const mode: BatchIngestMode = payload.mode ?? "best_effort";
  const label = payload.sourceBatchLabel;
  const nextTargets = targets.map((t) => normalizeSocialTarget(t));
  const results: BatchIngestResult[] = [];

  for (const input of payload.inputs ?? []) {
    const candidateKey = sourceIdentityKey(input);
    const suppressed = shouldSuppressInput(input);
    if (suppressed.suppressed) {
      results.push({
        sourceLabel: input.sourceLabel,
        sourceType: input.sourceType,
        candidateKey,
        targetId: null,
        outcome: "suppressed",
        reason: suppressed.reason,
        evidence: input.evidence,
      });
      continue;
    }

    const idx = findTargetIndex(nextTargets, input, payload.targetId);
    if (idx === -1) {
      results.push({
        sourceLabel: input.sourceLabel,
        sourceType: input.sourceType,
        candidateKey,
        targetId: null,
        outcome: "skipped",
        reason: "target_not_found",
        evidence: input.evidence,
      });
      continue;
    }

    const target = normalizeSocialTarget(nextTargets[idx]);
    const preview = sourceCandidateInputToSocialCandidate(target, input);
    const existing = target.socialCandidates ?? [];
    const existingById = existing.find((c) => c.id === preview.id);
    const duplicate = existing.find((c) => candidateIdentityKey(c) === candidateIdentityKey(preview));
    const matched = existingById ?? duplicate;

    if (matched) {
      if (matched.verificationStatus === "rejected") {
        results.push({
          sourceLabel: input.sourceLabel,
          sourceType: input.sourceType,
          candidateKey,
          targetId: target.id,
          outcome: "rejected",
          reason: "previously_rejected",
          evidence: input.evidence,
        });
        continue;
      }
      if (matched.visibilityState === "hide") {
        results.push({
          sourceLabel: input.sourceLabel,
          sourceType: input.sourceType,
          candidateKey,
          targetId: target.id,
          outcome: "suppressed",
          reason: "previously_hidden",
          evidence: input.evidence,
        });
        continue;
      }
      results.push({
        sourceLabel: input.sourceLabel,
        sourceType: input.sourceType,
        candidateKey,
        targetId: target.id,
        outcome: existingById ? "already_present" : "duplicate",
        reason: existingById ? "candidate_id_exists" : "same_platform_handle_url",
        evidence: input.evidence,
      });
      continue;
    }

    if (mode === "attach_only" && !payload.targetId) {
      results.push({
        sourceLabel: input.sourceLabel,
        sourceType: input.sourceType,
        candidateKey,
        targetId: target.id,
        outcome: "skipped",
        reason: "attach_only_requires_match_or_target",
        evidence: input.evidence,
      });
      continue;
    }

    const prevPrimaryId = target.primaryCandidateId;
    let updated = ingestSourceCandidateInputs(target, [input]);
    const inserted =
      (updated.socialCandidates ?? []).find((c) => c.id === preview.id) ??
      (updated.socialCandidates ?? []).find((c) => candidateIdentityKey(c) === candidateIdentityKey(preview));
    if (!inserted) {
      results.push({
        sourceLabel: input.sourceLabel,
        sourceType: input.sourceType,
        candidateKey,
        targetId: target.id,
        outcome: "skipped",
        reason: "ingest_no_candidate_added",
        evidence: input.evidence,
      });
      continue;
    }

    if (mode === "review_seed" || mode === "best_effort") {
      const seeded = applyReviewSeedMetadata(inserted, input, label);
      updated = patchCandidate(updated, inserted.id, seeded);
    }

    // No silent primary promotion in batch mode.
    updated = {
      ...updated,
      primaryCandidateId: prevPrimaryId ?? updated.primaryCandidateId,
    };
    nextTargets[idx] = normalizeSocialTarget(updated);
    results.push({
      sourceLabel: input.sourceLabel,
      sourceType: input.sourceType,
      candidateKey,
      targetId: target.id,
      outcome: mode === "review_seed" || mode === "best_effort" ? "created_review_candidate" : "attached",
      reason: mode === "review_seed" || mode === "best_effort" ? "seeded_into_review" : "attached_only",
      evidence: input.evidence,
    });
  }

  return { targets: nextTargets, results, summary: countSummary(results) };
}

