import type {
  BaseEntity,
  Cluster,
  ClusterAttachment,
  ClusterStatus,
  DiagnosticCode,
} from "./types";
import { buildMatchBreakdown } from "./scoring";
import { enrichEntityNames } from "./normalize";
import { mergeOverlappingClusters } from "./merge-clusters";

function toStatus(confidence: number): ClusterStatus {
  if (confidence >= 80) return "confirmed";
  if (confidence >= 65) return "probable";
  if (confidence >= 45) return "possible";
  return "unresolved";
}

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

function chooseDisplayName(head: BaseEntity, cluster: Cluster): string {
  const allNames = [
    head.name,
    ...cluster.google.map((x) => x.entity.name),
    ...cluster.doraShops.map((x) => x.entity.name),
  ].filter(Boolean);

  const shortestStrong = [...allNames].sort((a, b) => a.length - b.length)[0];
  return shortestStrong || head.name;
}

export function buildClusters(entities: BaseEntity[]): Cluster[] {
  const enriched = entities.map((e) => ({
    ...e,
    ...enrichEntityNames(e),
  }));

  const anchors = enriched.filter((e) => e.type === "google_place" || e.type === "dora_shop");

  const provisional: Cluster[] = anchors.map((anchor) => {
    const google: ClusterAttachment[] = [];
    const doraShops: ClusterAttachment[] = [];
    const doraPeople: ClusterAttachment[] = [];
    const reasons: string[] = [];
    const diagnostics = new Set<DiagnosticCode>();
    let confidence = 0;

    for (const entity of enriched) {
      const breakdown = buildMatchBreakdown(anchor, entity);
      confidence = Math.max(confidence, breakdown.score);
      breakdown.diagnostics.forEach((d) => diagnostics.add(d));

      if (entity.id === anchor.id) {
        const selfAttach: ClusterAttachment = {
          entity,
          decision: "merged",
          breakdown,
        };
        if (entity.type === "google_place") google.push(selfAttach);
        if (entity.type === "dora_shop") doraShops.push(selfAttach);
        continue;
      }

      if (entity.type === "dora_person") {
        if (breakdown.score >= 50) {
          doraPeople.push({
            entity,
            decision: "merged",
            breakdown,
          });
        } else if (breakdown.score >= 40) {
          doraPeople.push({
            entity,
            decision: "candidate_only",
            breakdown,
          });
          reasons.push(`person-candidate:${entity.name}:${breakdown.score}`);
        }
        continue;
      }

      if (breakdown.score >= 65) {
        const attach: ClusterAttachment = {
          entity,
          decision: "merged",
          breakdown,
        };
        if (entity.type === "google_place") google.push(attach);
        if (entity.type === "dora_shop") doraShops.push(attach);
      } else if (breakdown.score >= 45) {
        reasons.push(`possible-match:${entity.name}:${breakdown.score}`);
        const attach: ClusterAttachment = {
          entity,
          decision: "candidate_only",
          breakdown,
        };
        if (entity.type === "google_place") google.push(attach);
        if (entity.type === "dora_shop") doraShops.push(attach);
      } else {
        reasons.push(`not-merged:${entity.name}:${breakdown.score}`);
      }
    }

    const cluster: Cluster = {
      clusterId: anchor.id,
      displayName: anchor.name,
      displayAddress: anchor.address,
      lat: anchor.lat,
      lng: anchor.lng,
      clusterHeadType: anchor.type === "google_place" ? "google" : "dora_shop",
      headEntity: anchor,
      google: dedupeAttachments(google),
      doraShops: dedupeAttachments(doraShops),
      doraPeople: dedupeAttachments(doraPeople),
      confidence,
      status: toStatus(confidence),
      altNames: [],
      reasons,
      diagnostics: Array.from(diagnostics),
      zone: anchor.zone,
      corridor: anchor.corridor,
    };

    cluster.displayName = chooseDisplayName(anchor, cluster);

    if (cluster.google.some((x) => x.decision === "merged") && cluster.doraShops.some((x) => x.decision === "merged")) {
      cluster.clusterHeadType = "hybrid";
    }

    cluster.altNames = Array.from(
      new Set(
        [
          anchor.name,
          ...cluster.google.map((x) => x.entity.name),
          ...cluster.doraShops.map((x) => x.entity.name),
        ].filter(Boolean)
      )
    );

    return cluster;
  });

  const merged = mergeOverlappingClusters(provisional);

  return merged.sort((a, b) => {
    if (a.status !== b.status) {
      const rank = { confirmed: 4, probable: 3, possible: 2, unresolved: 1 };
      return rank[b.status] - rank[a.status];
    }
    return b.confidence - a.confidence;
  });
}
