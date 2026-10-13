import "server-only";
import { randomUUID } from "node:crypto";
import { listParsedCandidates } from "@/lib/source-intake/store";
import { listDoraQueue, listSocialQueue, listDoraResults, listSocialResults } from "@/lib/source-intake/phase2-store";
import type { ParsedCandidateRow } from "@/lib/source-intake/types";
import { recoverCandidateProfile } from "./profile-model";
import { refineCandidateProfile } from "./profile-refinement";
import { claimProfileRefinement, completeProfileRefinement, fingerprintCandidate, releaseProfileLease } from "./profile-store";
import type { CandidateProfile, ProfileRefinementRecord } from "./profile-types";

export type ProfileRunResult = { reviewKey: string; status: "completed" | "cached" | "busy" | "skipped" | "error";
  profile?: CandidateProfile; error?: string; nextAttemptAt?: string };
const TERMINAL = new Set(["approved", "merged", "rejected", "dismissed", "failed"]);
const reviewKeyOf = (row: { intakeId: string; candidateId: string }) => `${row.intakeId}::${row.candidateId}`;

/** Only existing pending candidates are eligible. A completed sibling lane is preserved. */
export async function refineReviewProfiles(reviewKeys: readonly string[]): Promise<ProfileRunResult[]> {
  const keys = [...new Set(reviewKeys)];
  if (!keys.length || keys.length > 3 || keys.some((key) => !/^[A-Za-z0-9._:-]{3,256}$/.test(key) || !key.includes("::"))) {
    throw new Error("invalid_review_keys");
  }
  const [dora, social, doraResults, socialResults] = await Promise.all([listDoraQueue(), listSocialQueue(), listDoraResults(), listSocialResults()]);
  const doraById = new Map(doraResults.map((row) => [row.queueItemId, row]));
  const socialById = new Map(socialResults.map((row) => [row.queueItemId, row]));
  const lanes = [...dora.map((row) => ({ ...row, effectiveStatus: doraById.get(row.id)?.finalStatus || doraById.get(row.id)?.status || row.status })),
    ...social.map((row) => ({ ...row, effectiveStatus: socialById.get(row.id)?.finalStatus || row.status }))];
  const candidateLoads = new Map<string, Promise<ParsedCandidateRow[]>>();
  const candidates = (intakeId: string) => {
    if (!candidateLoads.has(intakeId)) candidateLoads.set(intakeId, listParsedCandidates(intakeId));
    return candidateLoads.get(intakeId)!;
  };
  async function run(reviewKey: string): Promise<ProfileRunResult> {
    const ownLanes = lanes.filter((row) => reviewKeyOf(row) === reviewKey);
    if (!ownLanes.length || ownLanes.some((row) => TERMINAL.has(String(row.effectiveStatus).toLowerCase()))) {
      return { reviewKey, status: "skipped", error: "not_pending_review" };
    }
    const source = ownLanes[0];
    const candidate = (await candidates(source.intakeId)).find((row) => row.id === source.candidateId);
    if (!candidate || candidate.reviewAction === "hold") return { reviewKey, status: "skipped", error: "candidate_missing_or_held" };
    const fingerprint = fingerprintCandidate(candidate);
    let token: string | undefined;
    try {
      const claim = await claimProfileRefinement(reviewKey, fingerprint);
      if (claim.status === "cached") return { reviewKey, status: "cached", profile: claim.record.profile };
      if (claim.status === "busy") return { reviewKey, status: "busy", nextAttemptAt: new Date(Date.now() + 120_000).toISOString() };
      token = claim.token;
      const recovered = recoverCandidateProfile(candidate);
      const previous = claim.previous?.profile;
      const seed: CandidateProfile = previous ? { ...previous, observations: [], reasons: [], status: "not_checked" } : recovered;
      const profile = await refineCandidateProfile(seed);
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
      for (const field of ["bookingLinks", "socialLinks", "websiteLinks"] as const) {
        const original = recovered[field];
        const originalKeys = new Set(original.map((link) => `${link.url}|${link.attribution}`));
        const derived = profile[field].filter((link) => !originalKeys.has(`${link.url}|${link.attribution}`));
        // Preserve source-submitted facts; cap the latest derived projection, not its run history.
        if (derived.length > 24) profile.reasons.push("Latest view is limited to 24 derived links per kind; previous observations remain in run history.");
        profile[field] = [...original, ...derived.slice(-24)];
      }
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
