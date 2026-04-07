import { writeSurfaceRecoveryQueueArtifact } from "@/lib/resolver/registry-store";
import type { OperatorConsoleRow } from "./loadOperators";

export type SurfaceRecoveryCandidate = {
  id: string;
  name: string;
  city?: string;
  status: OperatorConsoleRow["resolverStatus"];
  childState: OperatorConsoleRow["childState"];
  reviewState?: OperatorConsoleRow["reviewState"];
  reviewNotes?: OperatorConsoleRow["reviewNotes"];
  evidenceCount: number;
  sourceTypes: string[];
  sourceTypeSummary: string;
  recoveryPriority: number;
};

function sourceTypes(op: OperatorConsoleRow): string[] {
  const tags = new Set<string>();
  for (const row of op.evidence || []) {
    tags.add(row.source);
    if (row.evidenceType === "directory_listing") tags.add("directory");
    if (row.evidenceType === "suite_container") tags.add("container");
  }
  return [...tags];
}

function identityStrength(op: OperatorConsoleRow): number {
  let score = 0;
  if ((op.name || "").trim() && op.name.toLowerCase() !== "unknown") score += 4;
  if ((op.city || "").trim()) score += 3;
  if ((op.canonical.phone || "").trim()) score += 3;
  if ((op.evidence || []).some((row) => Boolean((row.address || "").trim()))) score += 3;
  return score;
}

function statusScore(status: OperatorConsoleRow["resolverStatus"], childState: OperatorConsoleRow["childState"]): number {
  if (status === "hot") return 40;
  if (status === "enriched") return 30;
  if (childState === "resolved_child") return 20;
  return 0;
}

function recoveryPriority(op: OperatorConsoleRow): number {
  const src = sourceTypes(op);
  let score = statusScore(op.resolverStatus, op.childState);
  score += Math.min(20, (op.evidence || []).length);
  if (src.includes("directory")) score += 6;
  if (src.includes("container")) score += 4;
  score += identityStrength(op);
  return score;
}

function noDirectSurfaces(op: OperatorConsoleRow): boolean {
  return !op.canonical.booking && !op.canonical.instagram && !op.canonical.website;
}

export function selectSurfaceRecoveryQueue(operators: OperatorConsoleRow[]): SurfaceRecoveryCandidate[] {
  const selected = operators
    .filter((op) => op.resolverStatus === "hot" || op.resolverStatus === "enriched" || op.childState === "resolved_child")
    .filter((op) => noDirectSurfaces(op))
    .map((op) => {
      const sources = sourceTypes(op);
      return {
        id: op.id,
        name: op.name,
        city: op.city,
        status: op.resolverStatus,
        childState: op.childState,
        reviewState: op.reviewState,
        reviewNotes: op.reviewNotes,
        evidenceCount: (op.evidence || []).length,
        sourceTypes: sources,
        sourceTypeSummary: sources.join(" / "),
        recoveryPriority: recoveryPriority(op),
      };
    })
    .sort((a, b) => b.recoveryPriority - a.recoveryPriority);

  return selected;
}

export function writeSurfaceRecoveryQueue(candidates: SurfaceRecoveryCandidate[]): string {
  return writeSurfaceRecoveryQueueArtifact({
    generatedAt: new Date().toISOString(),
    total: candidates.length,
    queue: candidates,
  });
}

