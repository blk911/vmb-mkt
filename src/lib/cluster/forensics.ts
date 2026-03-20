/**
 * Surfaces attach / exclude decisions for validation and QA (e.g. Tribute Barbers forensic pass).
 * Does not change scoring policy — read-only explanation layer on top of the same rules as cluster-builder.
 */

import type {
  BaseEntity,
  Cluster,
  ClusterForensicReport,
  DiagnosticCode,
  ForensicCandidateResult,
} from "./types";
import { buildMatchBreakdown } from "./scoring";
import { getLocationLockResult } from "./location-lock";

function mergeDiagnostics(breakdown: { diagnostics: DiagnosticCode[] }, lock: { hasLock: boolean }): DiagnosticCode[] {
  const d = [...breakdown.diagnostics];
  if (!lock.hasLock) {
    if (!d.includes("NEARBY_NOISE_NO_LOCK")) d.push("NEARBY_NOISE_NO_LOCK");
  } else if (!d.includes("HARD_LOCATION_LOCK")) {
    d.push("HARD_LOCATION_LOCK");
  }
  return d;
}

export function buildClusterForensicReport(cluster: Cluster, allEntities: BaseEntity[]): ClusterForensicReport {
  const anchor = cluster.headEntity;

  const candidates: ForensicCandidateResult[] = allEntities
    .filter((e) => e.id !== anchor.id)
    .map((entity) => {
      const breakdown = buildMatchBreakdown(anchor, entity);
      const lock = getLocationLockResult(anchor, entity);

      let decision: ForensicCandidateResult["decision"] = "excluded_nearby_noise";
      let note = "Excluded as nearby corridor noise because no location lock fired.";

      if (!lock.hasLock) {
        decision = "excluded_nearby_noise";
        note = "Excluded as nearby corridor noise because no location lock fired.";
      } else if (entity.type === "dora_person") {
        if (breakdown.score >= 50) {
          decision = "attached";
          note = "Attached person record: passed hard location lock and score threshold.";
        } else if (breakdown.score >= 40) {
          decision = "candidate_only";
          note = "Candidate-only person record: locked but below full attach threshold.";
        } else {
          decision = "excluded_nearby_noise";
          note = "Locked by location but score too weak for attachment.";
        }
      } else {
        if (breakdown.score >= 65) {
          decision = "attached";
          note = "Attached shop/entity: passed hard location lock and score threshold.";
        } else if (breakdown.score >= 45) {
          decision = "candidate_only";
          note = "Candidate-only entity: locked but below merge threshold.";
        } else {
          decision = "excluded_nearby_noise";
          note = "Locked by location but score too weak for attachment.";
        }
      }

      return {
        anchorId: anchor.id,
        anchorName: anchor.name,
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        distanceMiles: breakdown.distanceMiles,
        score: breakdown.score,
        hasLock: lock.hasLock,
        lockType: lock.lockType,
        normalizedAddressMatchExact: lock.normalizedAddressMatchExact,
        suiteMatch: lock.suiteMatch,
        sameBuildingParcel: lock.sameBuildingParcel,
        decision,
        diagnostics: mergeDiagnostics(breakdown, lock),
        note,
      };
    })
    .sort((a, b) => {
      if (a.hasLock !== b.hasLock) return a.hasLock ? -1 : 1;
      if (a.decision !== b.decision) {
        const rank = {
          attached: 4,
          candidate_only: 3,
          blocked_merge: 2,
          excluded_nearby_noise: 1,
        };
        return rank[b.decision] - rank[a.decision];
      }
      return b.score - a.score;
    });

  return {
    clusterId: cluster.clusterId,
    displayName: cluster.displayName,
    anchorName: anchor.name,
    anchorType: anchor.type,
    displayAddress: cluster.displayAddress || anchor.address,
    totals: {
      candidatesConsidered: candidates.length,
      attached: candidates.filter((c) => c.decision === "attached").length,
      candidateOnly: candidates.filter((c) => c.decision === "candidate_only").length,
      excludedNearbyNoise: candidates.filter((c) => c.decision === "excluded_nearby_noise").length,
      blockedMerge: candidates.filter((c) => c.decision === "blocked_merge").length,
    },
    candidates,
  };
}

/** Dev-only: log forensic report to console for inspection (e.g. Tribute Barbers). */
export function logClusterForensicReport(report: ClusterForensicReport, label?: string): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[ClusterForensic ${label ?? report.clusterId}]`, report);
}
