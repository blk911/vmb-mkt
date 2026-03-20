import type { Cluster, ClusterAttachment, DiagnosticCode } from "./types";
import { buildMatchBreakdown } from "./scoring";

function dedupeAttachments(items: ClusterAttachment[]): ClusterAttachment[] {
  const seen = new Set<string>();
  const out: ClusterAttachment[] = [];

  for (const item of items) {
    if (seen.has(item.entity.id)) continue;
    seen.add(item.entity.id);
    out.push(item);
  }

  return out;
}

function chooseDominantCluster(a: Cluster, b: Cluster): Cluster {
  const aStrength =
    a.confidence +
    a.google.length * 5 +
    a.doraShops.length * 7 +
    a.doraPeople.length * 2;

  const bStrength =
    b.confidence +
    b.google.length * 5 +
    b.doraShops.length * 7 +
    b.doraPeople.length * 2;

  if (aStrength === bStrength) {
    if (a.clusterHeadType === "hybrid" && b.clusterHeadType !== "hybrid") return a;
    if (b.clusterHeadType === "hybrid" && a.clusterHeadType !== "hybrid") return b;
    if (a.clusterHeadType === "google" && b.clusterHeadType === "dora_shop") return a;
    return a;
  }

  return aStrength > bStrength ? a : b;
}

function shouldMergeClusters(a: Cluster, b: Cluster): { merge: boolean; reason: DiagnosticCode[] } {
  const breakdown = buildMatchBreakdown(a.headEntity, b.headEntity);
  const reason: DiagnosticCode[] = [...breakdown.diagnostics];

  const bothShopLike =
    a.headEntity.type !== "dora_person" && b.headEntity.type !== "dora_person";

  if (!bothShopLike) {
    return { merge: false, reason: ["PERSON_NOT_SHOP"] };
  }

  const strongEnough =
    breakdown.score >= 65 ||
    (breakdown.distanceMiles <= 0.03 && breakdown.nameScore >= 18 && breakdown.categoryScore >= 5);

  const blockedByCompetingBrands =
    breakdown.distanceMiles <= 0.03 &&
    breakdown.nameScore <= 8 &&
    a.headEntity.category === b.headEntity.category &&
    !!a.headEntity.brandCoreName &&
    !!b.headEntity.brandCoreName &&
    a.headEntity.brandCoreName !== b.headEntity.brandCoreName;

  if (blockedByCompetingBrands) {
    return { merge: false, reason: ["COMPETING_BRAND", "MULTI_ANCHOR_CONFLICT"] };
  }

  return { merge: strongEnough, reason };
}

function mergeTwoClusters(primary: Cluster, secondary: Cluster): Cluster {
  const google = dedupeAttachments([...primary.google, ...secondary.google]);
  const doraShops = dedupeAttachments([...primary.doraShops, ...secondary.doraShops]);
  const doraPeople = dedupeAttachments([...primary.doraPeople, ...secondary.doraPeople]);

  const altNames = Array.from(
    new Set(
      [
        primary.displayName,
        secondary.displayName,
        ...primary.altNames,
        ...secondary.altNames,
        primary.headEntity.name,
        secondary.headEntity.name,
      ].filter(Boolean)
    )
  );

  const diagnostics = Array.from(
    new Set<DiagnosticCode>([...primary.diagnostics, ...secondary.diagnostics, "MERGED_BY_DOMINANT_ANCHOR"])
  );

  const reasons = Array.from(
    new Set([
      ...primary.reasons,
      ...secondary.reasons,
      `merged:${secondary.clusterId}:into:${primary.clusterId}`,
    ])
  );

  const confidence = Math.max(primary.confidence, secondary.confidence);

  const status =
    confidence >= 80 ? "confirmed" : confidence >= 65 ? "probable" : confidence >= 45 ? "possible" : "unresolved";

  const clusterHeadType: Cluster["clusterHeadType"] =
    google.length > 0 && doraShops.length > 0 ? "hybrid" : primary.clusterHeadType;

  return {
    ...primary,
    google,
    doraShops,
    doraPeople,
    altNames,
    diagnostics,
    reasons,
    confidence,
    status,
    clusterHeadType,
  };
}

export function mergeOverlappingClusters(input: Cluster[]): Cluster[] {
  const remaining = [...input];
  const merged: Cluster[] = [];

  while (remaining.length > 0) {
    let base = remaining.shift()!;
    let i = 0;

    while (i < remaining.length) {
      const candidate = remaining[i];
      const result = shouldMergeClusters(base, candidate);

      if (result.merge) {
        const dominant = chooseDominantCluster(base, candidate);
        const secondary = dominant.clusterId === base.clusterId ? candidate : base;

        base = mergeTwoClusters(dominant, secondary);
        base.diagnostics = Array.from(new Set([...base.diagnostics, ...result.reason]));

        remaining.splice(i, 1);
        i = 0;
        continue;
      }

      i++;
    }

    merged.push(base);
  }

  return merged;
}
