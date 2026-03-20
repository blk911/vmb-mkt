import type { BaseEntity, Cluster } from "./types";
import { scoreMatch } from "./scoring";

export function buildClusters(entities: BaseEntity[]): Cluster[] {
  const anchors = entities.filter((e) => e.type === "google_place" || e.type === "dora_shop");

  const clusters: Cluster[] = [];

  for (const anchor of anchors) {
    const cluster: Cluster = {
      clusterId: anchor.id,
      displayName: anchor.name,
      lat: anchor.lat,
      lng: anchor.lng,
      clusterHeadType: anchor.type === "google_place" ? "google" : "dora_shop",
      google: [],
      doraShops: [],
      doraPeople: [],
      confidence: 0,
      status: "unresolved",
      reasons: [],
    };

    for (const entity of entities) {
      if (entity.id === anchor.id) continue;

      const { score, distance: dist } = scoreMatch(anchor, entity);

      if (score >= 65) {
        if (entity.type === "google_place") cluster.google.push(entity);
        if (entity.type === "dora_shop") cluster.doraShops.push(entity);
        if (entity.type === "dora_person") cluster.doraPeople.push(entity);
      } else if (score >= 45) {
        cluster.reasons.push(`possible_match:${entity.name}:${score}:${dist.toFixed(2)}`);
      }
    }

    const attached = [...cluster.google, ...cluster.doraShops, ...cluster.doraPeople];
    cluster.confidence = attached.length
      ? Math.max(...attached.map((e) => scoreMatch(anchor, e).score))
      : scoreMatch(anchor, anchor).score;

    if (cluster.confidence >= 80) cluster.status = "confirmed";
    else if (cluster.confidence >= 65) cluster.status = "probable";
    else if (cluster.confidence >= 45) cluster.status = "possible";
    else cluster.status = "unresolved";

    clusters.push(cluster);
  }

  return clusters;
}
