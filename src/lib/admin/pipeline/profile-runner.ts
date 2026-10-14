import "server-only";
import { randomUUID } from "node:crypto";
import { listParsedCandidates } from "@/lib/source-intake/store";
import type { ParsedCandidateRow } from "@/lib/source-intake/types";
import { adaptStoredCandidateEvidence } from "@/lib/catalog/source-adapters";
import { loadProfileEvidenceSources } from "./profile-source-evidence";
import { recoverCandidateProfile, reconcileCandidateProfile } from "./profile-model";
import { refineCandidateProfile } from "./profile-refinement";
import { claimProfileRefinement, completeProfileRefinement, fingerprintCandidate, releaseProfileLease } from "./profile-store";
import type { CandidateProfile, ProfileRefinementRecord } from "./profile-types";

export type ProfileRunResult = { reviewKey: string; status: "completed" | "cached" | "busy" | "skipped" | "error";
  profile?: CandidateProfile; error?: string; nextAttemptAt?: string };

/** Refresh source facts for any existing candidate without writing review decisions or queues. */
export async function refineReviewProfiles(reviewKeys: readonly string[]): Promise<ProfileRunResult[]> {
  const keys = [...new Set(reviewKeys)];
  if (!keys.length || keys.length > 3 || keys.some((key) => !/^[A-Za-z0-9._:-]{3,256}$/.test(key) || !key.includes("::"))) {
    throw new Error("invalid_review_keys");
  }
  const sources = await loadProfileEvidenceSources();
  const candidateLoads = new Map<string, Promise<ParsedCandidateRow[]>>();
  const candidates = (intakeId: string) => {
    if (!candidateLoads.has(intakeId)) candidateLoads.set(intakeId, listParsedCandidates(intakeId));
    return candidateLoads.get(intakeId)!;
  };
  async function run(reviewKey: string): Promise<ProfileRunResult> {
    if (reviewKey.split("::").length !== 2) return { reviewKey, status: "skipped", error: "ambiguous_source_key" };
    const separator = reviewKey.indexOf("::");
    const intakeId = reviewKey.slice(0, separator), candidateId = reviewKey.slice(separator + 2);
    if (intakeId.includes(":") || candidateId.includes(":")) return { reviewKey, status: "skipped", error: "ambiguous_source_key" };
    const candidate = (await candidates(intakeId)).find((row) => row.id === candidateId && row.intakeId === intakeId);
    if (!candidate) return { reviewKey, status: "skipped", error: "candidate_missing" };
    const base = recoverCandidateProfile(candidate);
    const evidence = adaptStoredCandidateEvidence(candidate, base, sources.get(JSON.stringify([intakeId, candidateId])) || {});
    const recovered = reconcileCandidateProfile({ ...base, reasons: [...base.reasons, ...evidence.conflicts] }, evidence.links);
    const fingerprint = fingerprintCandidate(candidate, evidence.links);
    let token: string | undefined;
    try {
      const claim = await claimProfileRefinement(reviewKey, fingerprint);
      if (claim.status === "cached") return { reviewKey, status: "cached", profile: reconcileCandidateProfile(claim.record.profile, recovered) };
      if (claim.status === "busy") return { reviewKey, status: "busy", nextAttemptAt: new Date(Date.now() + 120_000).toISOString() };
      token = claim.token;
      const previous = claim.previous?.profile ? { ...claim.previous.profile,
        candidateRef: !claim.previous.profile.candidateRef || claim.previous.profile.candidateRef === reviewKey
          ? JSON.stringify([candidate.intakeId, candidate.id]) : claim.previous.profile.candidateRef } : undefined;
      const combined = claim.previous?.fingerprint === fingerprint && previous
        ? reconcileCandidateProfile(previous, recovered) : reconcileCandidateProfile(recovered, ...(previous ? [previous] : []));
      const seed: CandidateProfile = { ...combined, observations: [], status: "not_checked" };
      let profile = await refineCandidateProfile(seed);
      const now = new Date().toISOString();
      // A failed attempt never renews the last successful observation timestamp.
      const retrieved = profile.observations.some((observation) => observation.outcome === "retrieved");
      profile.lastAttemptAt = now;
      // HTTP 200 alone is not a successful provider match. Only the evidence engine
      // may advance this timestamp; failed or unmatched checks retain the prior one.
      profile.lastSuccessfulAt = profile.lastSuccessfulAt || previous?.lastSuccessfulAt;
      const retryMs = profile.status === "error" ? 60 * 60_000 : 24 * 60 * 60_000;
      profile.nextAttemptAt = new Date(Date.now() + retryMs).toISOString();
      if (!retrieved) profile.freshness = previous?.lastSuccessfulAt ? "stale" : recovered.freshness;
      // The latest display is bounded; every previous run remains immutable below.
      profile.observations = [...(previous?.observations || []), ...profile.observations].slice(-12);
      // Retain safe historical links and their provenance even after source edits.
      // The fetch engine bounds newly discovered links; history is not truncated.
      profile = reconcileCandidateProfile(profile, recovered, ...(previous ? [previous] : []));
      profile.observations = profile.observations.sort((left, right) => left.fetchedAt.localeCompare(right.fetchedAt)).slice(-12);
      const record: ProfileRefinementRecord = { schemaVersion: 1, reviewKey, fingerprint, runId: `profile_${randomUUID()}`, profile, completedAt: now };
      if (!await completeProfileRefinement(record, token)) return { reviewKey, status: "busy", error: "refinement_lease_changed" };
      token = undefined;
      return { reviewKey, status: "completed", profile };
    } catch {
      return { reviewKey, status: "error", error: "profile_refinement_unavailable", nextAttemptAt: new Date(Date.now() + 60 * 60_000).toISOString() };
    } finally {
      if (token) await releaseProfileLease(reviewKey, token).catch(() => undefined);
    }
  }
  const results = new Array<ProfileRunResult>(keys.length);
  let cursor = 0;
  // At most two candidate fetch chains in a request; per-candidate cross-instance leases deduplicate work.
  await Promise.all(Array.from({ length: Math.min(2, keys.length) }, async () => {
    while (cursor < keys.length) { const index = cursor++; results[index] = await run(keys[index]); }
  }));
  return results;
}
