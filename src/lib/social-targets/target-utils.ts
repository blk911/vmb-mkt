import { isTargetActionable } from "@/lib/social-targets/target-visibility";
import type { ActivitySignal, ProfileHealth, ReferralEdge, SocialTarget } from "@/types/social-target";

export function computeReferralCounts(targets: SocialTarget[], edges: ReferralEdge[]): SocialTarget[] {
  const outgoing = new Map<string, number>();
  const incomingByHandle = new Map<string, number>();

  for (const edge of edges) {
    outgoing.set(edge.fromTargetId, (outgoing.get(edge.fromTargetId) ?? 0) + edge.timesSeen);
    incomingByHandle.set(edge.toHandle, (incomingByHandle.get(edge.toHandle) ?? 0) + edge.timesSeen);
  }

  return targets.map((target) => {
    const incoming =
      incomingByHandle.get(target.handle.replace(/^@/, "")) ?? incomingByHandle.get(target.handle) ?? 0;
    const outgoingCount = outgoing.get(target.id) ?? 0;

    return {
      ...target,
      referralCount: outgoingCount,
      referredByCount: incoming,
      isReferralHub: incoming >= 2,
    };
  });
}

export function upsertReferralEdge(
  edges: ReferralEdge[],
  input: {
    fromTargetId: string;
    fromHandle: string;
    toHandle: string;
    referredCategory: ReferralEdge["referredCategory"];
    note?: string;
    toTargetId?: string;
  }
): ReferralEdge[] {
  const cleanToHandle = input.toHandle.replace(/^@/, "").trim();
  const existing = edges.find(
    (edge) =>
      edge.fromTargetId === input.fromTargetId &&
      edge.toHandle.replace(/^@/, "").toLowerCase() === cleanToHandle.toLowerCase() &&
      edge.referredCategory === input.referredCategory
  );

  if (existing) {
    return edges.map((edge) =>
      edge.id === existing.id
        ? {
            ...edge,
            timesSeen: edge.timesSeen + 1,
            confidence: edge.timesSeen + 1 >= 2 ? "multi" : "single",
            note: input.note || edge.note,
          }
        : edge
    );
  }

  const created: ReferralEdge = {
    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromTargetId: input.fromTargetId,
    fromHandle: input.fromHandle.replace(/^@/, ""),
    toHandle: cleanToHandle,
    toTargetId: input.toTargetId,
    referredCategory: input.referredCategory,
    confidence: "single",
    timesSeen: 1,
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  return [created, ...edges];
}

export function getTopReferredHandles(edges: ReferralEdge[]) {
  const counts = new Map<string, { toHandle: string; category: string; timesSeen: number }>();

  for (const edge of edges) {
    const key = `${edge.toHandle.toLowerCase()}::${edge.referredCategory}`;
    const existing = counts.get(key);
    if (existing) {
      existing.timesSeen += edge.timesSeen;
    } else {
      counts.set(key, {
        toHandle: edge.toHandle,
        category: edge.referredCategory,
        timesSeen: edge.timesSeen,
      });
    }
  }

  return [...counts.values()].sort((a, b) => b.timesSeen - a.timesSeen);
}

export function getActivityRank(signal?: ActivitySignal): number {
  switch (signal) {
    case "hot":
      return 4;
    case "warm":
      return 3;
    case "cold":
      return 2;
    default:
      return 1;
  }
}

export function getProfileHealthRank(health?: ProfileHealth): number {
  switch (health) {
    case "active":
      return 5;
    case "private":
      return 4;
    case "stale":
      return 3;
    case "renamed_or_moved":
      return 2;
    case "not_found":
      return 1;
    default:
      return 0;
  }
}

export function computePriorityScore(target: SocialTarget): number {
  if (target.profileHealth === "not_found") return 0;

  let score = 0;

  if (target.tags?.some((tag) => tag.toUpperCase() === "HOT")) score += 25;
  if (target.booking === "dm") score += 10;
  if (target.booking === "link") score += 8;
  if (target.booking === "phone") score += 6;

  if ((target.followers ?? 0) >= 5000) score += 15;
  else if ((target.followers ?? 0) >= 2000) score += 10;
  else if ((target.followers ?? 0) >= 800) score += 6;
  else if ((target.followers ?? 0) >= 300) score += 3;

  switch (target.activitySignal) {
    case "hot":
      score += 25;
      break;
    case "warm":
      score += 15;
      break;
    case "cold":
      score += 5;
      break;
  }

  switch (target.profileHealth) {
    case "active":
      score += 20;
      break;
    case "private":
      score += 8;
      break;
    case "stale":
      score -= 10;
      break;
    case "renamed_or_moved":
      score -= 20;
      break;
    case "not_found":
      score -= 100;
      break;
  }

  if (target.status === "contacted") score -= 5;
  if (target.status === "responded") score += 8;
  if (target.status === "live") score -= 20;

  return Math.max(0, Math.min(100, score));
}

/** Effective score for display, sort, and filters — respects manual operator override. */
export function getEffectivePriorityScore(target: SocialTarget): number {
  if (target.priorityScoreManual === true && typeof target.priorityScore === "number") {
    return Math.max(0, Math.min(100, target.priorityScore));
  }
  return computePriorityScore(target);
}

export function withComputedPriorityScore(targets: SocialTarget[]): SocialTarget[] {
  return targets.map((target) => ({
    ...target,
    priorityScore: getEffectivePriorityScore(target),
  }));
}

export function isReadyToAttack(target: SocialTarget): boolean {
  return (
    isTargetActionable(target) &&
    (target.activitySignal === "hot" || target.activitySignal === "warm") &&
    (target.status ?? "new") === "new"
  );
}
