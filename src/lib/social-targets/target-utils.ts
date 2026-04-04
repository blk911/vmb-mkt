import type { ReferralEdge, SocialTarget } from "@/types/social-target";

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
