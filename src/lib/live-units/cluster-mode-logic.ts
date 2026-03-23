/**
 * Conservative salon-anchor clusters from the current filtered row set.
 * Under-groups by design — hints only, not perfect graph resolution.
 */
import type { DerivedEntityDisplayState } from "./entity-display-types";
import type {
  ClusterBuildDebug,
  ClusterModeRow,
  ClusterReasonTag,
  ClusterStrength,
  FallbackAnchorHint,
  RelatedRowMatch,
  SalonAnchorCluster,
} from "./cluster-mode-types";
import { getSurfacedOperatorsForBusinessId } from "./operator-extraction-logic";
import type { SurfacedOperator } from "./operator-extraction-types";
import type { DerivedServiceSignals } from "./service-signal-types";
import { serviceSignalLabel } from "./service-signal-logic";

const ACTIVE_ZONE_IDS = new Set(["QUEBEC_CORRIDOR", "DOWNTOWN_CORE", "CHERRY_CREEK", "CC01"]);

/** Prefer missing related rows over false positives. */
const MIN_ANCHOR_SCORE = 36;
/** v1.1: small relaxation — still rejects weak matches. */
const MIN_RELATIONSHIP_SCORE = 48;
/** v1.1: max distance for assigning a related row to an anchor (miles). Slightly widened from 0.22; still tight. */
const MAX_ASSIGN_DISTANCE_MI = 0.26;
const SAME_BUILDING_MI = 0.09;

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function geoMiles(a: ClusterModeRow, b: ClusterModeRow): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  if (Number.isNaN(a.lat) || Number.isNaN(b.lat)) return null;
  return milesBetween(a.lat, a.lon, b.lat, b.lon);
}

function normalizeTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = normalizeTokens(a);
  const tb = normalizeTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union ? (inter / union) * 100 : 0;
}

function platformSignalCount(row: ClusterModeRow): number {
  const ps = row.platformSignals;
  if (!ps) return 0;
  let n = 0;
  for (const p of ["fresha", "vagaro", "booksy", "glossgenius"] as const) {
    if (ps[p]?.isBookable) n += 1;
  }
  return n;
}

function getZoneId(row: ClusterModeRow): string | null {
  return row.raw_snippets?.google?.zone_id?.trim() || null;
}

/**
 * Anchor suitability 0–100 — salon / location / multi-tech / shop / signals.
 */
export function scoreAnchorCandidate(
  row: ClusterModeRow,
  ed: DerivedEntityDisplayState,
  svc: DerivedServiceSignals,
  validatedOpCount: number
): number {
  let s = 22;

  if (ed.liveLabel === "Live Salon" || ed.liveLabel === "Live Mixed") s += 18;
  else if (ed.liveLabel === "Live Tech") s += 4;

  if (ed.entityKind === "salon") s += 16;
  else if (ed.entityKind === "mixed_business") s += 14;
  else if (ed.entityKind === "tech") s -= 8;

  const rel = ed.relationshipHint;
  if (rel === "likely_salon_anchor" || rel === "likely_multi_tech_location") s += 14;
  if (rel === "likely_suite_operator") s -= 10;
  if (rel === "standalone_unknown") s -= 6;

  if ((row.subtype || "").toLowerCase() === "storefront") s += 8;
  if (row.shop_license?.trim()) s += 12;
  if ((row.tech_count_nearby ?? 0) >= 2) s += 8;
  if ((row.tech_count_nearby ?? 0) >= 4) s += 4;

  if (svc.isMultiService) s += 6;
  if (platformSignalCount(row) > 0) s += 8;
  if (validatedOpCount > 0) s += Math.min(14, validatedOpCount * 5);

  const z = getZoneId(row);
  if (z && ACTIVE_ZONE_IDS.has(z)) s += 5;

  if (ed.likelyLive === false) s -= 12;

  return Math.max(0, Math.min(100, Math.round(s)));
}

function isAnchorEligible(row: ClusterModeRow, ed: DerivedEntityDisplayState, anchorScore: number): boolean {
  if (anchorScore < MIN_ANCHOR_SCORE) return false;
  if (ed.entityKind === "tech" && !row.shop_license?.trim() && anchorScore < 66) return false;
  if (ed.relationshipHint === "likely_suite_operator" && anchorScore < 52) return false;
  return true;
}

function serviceOverlapRatio(a: DerivedServiceSignals, b: DerivedServiceSignals): number {
  const sa = new Set(a.serviceSignals);
  const sb = new Set(b.serviceSignals);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  return inter / Math.min(sa.size, sb.size);
}

function operatorNameHintsOverlap(candidateName: string, ops: SurfacedOperator[]): boolean {
  const toks = normalizeTokens(candidateName);
  if (toks.size === 0) return false;
  for (const op of ops) {
    const on = normalizeTokens(op.operatorName);
    for (const t of toks) if (on.has(t)) return true;
  }
  return false;
}

/**
 * Related row to anchor — returns null if evidence is too weak or too far.
 */
export function scoreRelatedRowToAnchor(
  anchor: ClusterModeRow,
  candidate: ClusterModeRow,
  anchorEd: DerivedEntityDisplayState,
  candidateEd: DerivedEntityDisplayState,
  anchorSvc: DerivedServiceSignals,
  candidateSvc: DerivedServiceSignals,
  anchorOps: SurfacedOperator[]
): RelatedRowMatch | null {
  if (candidate.live_unit_id === anchor.live_unit_id) return null;

  const tags: ClusterReasonTag[] = [];
  let score = 0;

  const dist = geoMiles(anchor, candidate);
  if (dist != null) {
    if (dist > MAX_ASSIGN_DISTANCE_MI) return null;
    if (dist <= SAME_BUILDING_MI) {
      tags.push("same_building");
      score += 42;
    } else {
      score += Math.max(0, 40 - dist * 120);
      tags.push("tech_near_salon");
    }
  } else {
    const sameZip =
      (anchor.zip || "").trim() &&
      (candidate.zip || "").trim() &&
      anchor.zip === candidate.zip &&
      (anchor.city || "").toLowerCase() === (candidate.city || "").toLowerCase();
    if (sameZip) {
      score += 18;
      tags.push("same_zone");
    } else {
      return null;
    }
  }

  const nameOv = tokenOverlapScore(anchor.name_display, candidate.name_display);
  if (nameOv >= 28) {
    tags.push("shared_name");
    score += nameOv * 0.35;
  }

  const svcOv = serviceOverlapRatio(anchorSvc, candidateSvc);
  if (svcOv >= 0.34) {
    tags.push("service_overlap");
    score += svcOv * 28;
  }

  const anchorSalonLike = anchorEd.entityKind === "salon" || anchorEd.entityKind === "mixed_business";
  const candTechLike =
    candidateEd.entityKind === "tech" ||
    candidateEd.relationshipHint === "likely_suite_operator" ||
    (candidate.subtype || "").toLowerCase() === "suite";
  if (anchorSalonLike && candTechLike) {
    score += 12;
    if (!tags.includes("tech_near_salon") && !tags.includes("same_building")) tags.push("suite_or_tech_context");
  }

  if (operatorNameHintsOverlap(candidate.name_display, anchorOps)) {
    tags.push("validated_operator_overlap");
    score += 22;
  }

  const zA = getZoneId(anchor);
  const zB = getZoneId(candidate);
  if (zA && zB && zA === zB && !tags.includes("same_zone")) {
    tags.push("same_zone");
    score += 6;
  }

  /** Reject competing strong anchors at same spot without name tie */
  const candAnchorish =
    candidateEd.entityKind === "salon" ||
    (candidate.shop_license?.trim() && (candidate.subtype || "").toLowerCase() === "storefront");
  if (candAnchorish && nameOv < 22 && svcOv < 0.2 && dist != null && dist > SAME_BUILDING_MI) {
    return null;
  }

  score = Math.round(Math.min(100, score));

  if (score < MIN_RELATIONSHIP_SCORE) return null;

  return {
    unitId: candidate.live_unit_id,
    relationshipScore: score,
    reasonTags: Array.from(new Set(tags)),
  };
}

function deriveClusterStrength(
  anchorScore: number,
  relatedCount: number,
  validatedOpCount: number,
  platformCount: number
): ClusterStrength {
  let w = 0;
  if (anchorScore >= 62) w += 3;
  else if (anchorScore >= 48) w += 2;
  else w += 1;
  if (relatedCount >= 2) w += 2;
  else if (relatedCount >= 1) w += 1;
  if (validatedOpCount >= 2) w += 2;
  else if (validatedOpCount >= 1) w += 1;
  if (platformCount >= 1) w += 1;
  if (w >= 7) return "high";
  if (w >= 5) return "medium";
  return "low";
}

function buildClusterSummary(
  anchor: ClusterModeRow,
  relatedCount: number,
  validatedOpCount: number,
  ed: DerivedEntityDisplayState
): string {
  const kind =
    ed.entityKind === "salon" ? "Salon-style anchor" : ed.entityKind === "mixed_business" ? "Mixed-service anchor" : "Location anchor";
  const opPart =
    validatedOpCount > 0
      ? `${validatedOpCount} validated operator${validatedOpCount === 1 ? "" : "s"}`
      : "no validated operators yet";
  const relPart = relatedCount > 0 ? `${relatedCount} related row${relatedCount === 1 ? "" : "s"}` : "no related rows grouped";
  return `${kind} — ${relPart}; ${opPart}. Grouping is heuristic (hints only).`;
}

export type ClusterBuildContext = {
  entityDisplayByUnitId: Map<string, DerivedEntityDisplayState>;
  serviceSignalsByUnitId: Map<string, DerivedServiceSignals>;
};

function scoreBandLabelForHint(score: number): string {
  if (score >= 72) return "Strong candidate";
  if (score >= 55) return "Moderate candidate";
  return "Weak candidate";
}

function buildReasonSummary(
  row: ClusterModeRow,
  ed: DerivedEntityDisplayState,
  svc: DerivedServiceSignals,
  validatedOpCount: number
): string {
  const parts: string[] = [ed.entityKind.replaceAll("_", " ")];
  if ((row.subtype || "").toLowerCase() === "storefront") parts.push("storefront");
  if (row.shop_license?.trim()) parts.push("shop license");
  if ((row.tech_count_nearby ?? 0) >= 2) parts.push("nearby techs");
  if (svc.isMultiService) parts.push("multi-service");
  if (validatedOpCount > 0) parts.push("validated operators");
  if (platformSignalCount(row) > 0) parts.push("booking signal");
  return parts.join(" · ");
}

export type ClusterBuildResult = {
  clusters: SalonAnchorCluster[];
  debug: ClusterBuildDebug;
};

export function buildSalonAnchorClusters(rows: ClusterModeRow[], ctx: ClusterBuildContext): ClusterBuildResult {
  const emptyDebug = (partial: Partial<ClusterBuildDebug> = {}): ClusterBuildDebug => ({
    rowsConsidered: rows.length,
    anchorCandidatesFound: 0,
    clustersFormed: 0,
    totalRelatedRowsGrouped: 0,
    fallbackAnchors: [],
    ...partial,
  });

  if (rows.length === 0) {
    return { clusters: [], debug: emptyDebug({ rowsConsidered: 0 }) };
  }

  const byId = new Map(rows.map((r) => [r.live_unit_id, r] as const));

  const anchorScores = new Map<string, number>();
  const eligibleAnchors: string[] = [];

  for (const row of rows) {
    const ed = ctx.entityDisplayByUnitId.get(row.live_unit_id);
    const svc = ctx.serviceSignalsByUnitId.get(row.live_unit_id);
    if (!ed || !svc) continue;
    const ops = getSurfacedOperatorsForBusinessId(row.live_unit_id);
    const sc = scoreAnchorCandidate(row, ed, svc, ops.length);
    anchorScores.set(row.live_unit_id, sc);
    if (isAnchorEligible(row, ed, sc)) eligibleAnchors.push(row.live_unit_id);
  }

  eligibleAnchors.sort((a, b) => (anchorScores.get(b) ?? 0) - (anchorScores.get(a) ?? 0));

  const anchorSet = new Set(eligibleAnchors);
  const assignment = new Map<string, { anchorId: string; match: RelatedRowMatch }>();

  for (const cand of rows) {
    if (anchorSet.has(cand.live_unit_id)) continue;
    const candEd = ctx.entityDisplayByUnitId.get(cand.live_unit_id);
    const candSvc = ctx.serviceSignalsByUnitId.get(cand.live_unit_id);
    if (!candEd || !candSvc) continue;

    let best: { anchorId: string; match: RelatedRowMatch } | null = null;

    for (const anchorId of eligibleAnchors) {
      const anchor = byId.get(anchorId);
      if (!anchor) continue;
      const anchorEd = ctx.entityDisplayByUnitId.get(anchorId)!;
      const anchorSvc = ctx.serviceSignalsByUnitId.get(anchorId)!;
      const anchorOps = getSurfacedOperatorsForBusinessId(anchorId);

      const m = scoreRelatedRowToAnchor(anchor, cand, anchorEd, candEd, anchorSvc, candSvc, anchorOps);
      if (!m) continue;
      if (!best || m.relationshipScore > best.match.relationshipScore) {
        best = { anchorId, match: m };
      }
    }

    if (best) {
      const prev = assignment.get(cand.live_unit_id);
      if (!prev || best.match.relationshipScore > prev.match.relationshipScore) {
        assignment.set(cand.live_unit_id, best);
      }
    }
  }

  const relatedByAnchor = new Map<string, RelatedRowMatch[]>();
  for (const aid of eligibleAnchors) relatedByAnchor.set(aid, []);

  for (const [candId, { anchorId, match }] of assignment) {
    if (anchorSet.has(candId)) continue;
    const list = relatedByAnchor.get(anchorId);
    if (list) list.push(match);
  }

  const clusters: SalonAnchorCluster[] = [];

  for (const anchorId of eligibleAnchors) {
    const anchor = byId.get(anchorId);
    if (!anchor) continue;
    const ed = ctx.entityDisplayByUnitId.get(anchorId)!;
    const svc = ctx.serviceSignalsByUnitId.get(anchorId)!;
    const matches = (relatedByAnchor.get(anchorId) ?? []).sort((a, b) => b.relationshipScore - a.relationshipScore);
    const relatedIds = matches.map((m) => m.unitId);
    const ops = getSurfacedOperatorsForBusinessId(anchorId);

    const serviceUnion = new Set<string>();
    for (const s of svc.serviceSignals) serviceUnion.add(serviceSignalLabel(s));
    for (const rid of relatedIds) {
      const rs = ctx.serviceSignalsByUnitId.get(rid);
      if (rs) for (const s of rs.serviceSignals) serviceUnion.add(serviceSignalLabel(s));
    }

    const anchorScore = anchorScores.get(anchorId) ?? 0;
    const seenP = new Set<string>();
    for (const p of ["fresha", "vagaro", "booksy", "glossgenius"] as const) {
      if (anchor.platformSignals?.[p]?.isBookable) seenP.add(p);
    }
    for (const rid of relatedIds) {
      const r = byId.get(rid);
      if (!r?.platformSignals) continue;
      for (const p of ["fresha", "vagaro", "booksy", "glossgenius"] as const) {
        if (r.platformSignals[p]?.isBookable) seenP.add(p);
      }
    }
    const platformClusterCount = seenP.size;

    const strength = deriveClusterStrength(anchorScore, relatedIds.length, ops.length, platformClusterCount);

    clusters.push({
      anchorUnitId: anchorId,
      anchorScore,
      clusterStrength: strength,
      relatedUnitIds: relatedIds,
      relatedMatches: matches,
      validatedOperatorCount: ops.length,
      platformSignalCount: platformClusterCount,
      serviceSignals: Array.from(serviceUnion).sort((a, b) => a.localeCompare(b)),
      zoneId: getZoneId(anchor),
      operatorSummary: buildClusterSummary(anchor, relatedIds.length, ops.length, ed),
    });
  }

  /** Standalone “weak” rows are omitted as separate clusters — only anchors drive cards. */
  clusters.sort((a, b) => {
    const rank: Record<ClusterStrength, number> = { high: 3, medium: 2, low: 1 };
    const dr = rank[b.clusterStrength] - rank[a.clusterStrength];
    if (dr !== 0) return dr;
    if (b.validatedOperatorCount !== a.validatedOperatorCount) return b.validatedOperatorCount - a.validatedOperatorCount;
    if (b.platformSignalCount !== a.platformSignalCount) return b.platformSignalCount - a.platformSignalCount;
    return b.anchorScore - a.anchorScore;
  });

  let totalRelatedRowsGrouped = 0;
  for (const c of clusters) totalRelatedRowsGrouped += c.relatedUnitIds.length;

  let fallbackAnchors: FallbackAnchorHint[] = [];
  if (eligibleAnchors.length === 0 && rows.length > 0) {
    const scored: Array<{
      row: ClusterModeRow;
      score: number;
      ed: DerivedEntityDisplayState;
      svc: DerivedServiceSignals;
      opCount: number;
    }> = [];
    for (const row of rows) {
      const ed = ctx.entityDisplayByUnitId.get(row.live_unit_id);
      const svc = ctx.serviceSignalsByUnitId.get(row.live_unit_id);
      if (!ed || !svc) continue;
      const ops = getSurfacedOperatorsForBusinessId(row.live_unit_id);
      const sc = anchorScores.get(row.live_unit_id) ?? scoreAnchorCandidate(row, ed, svc, ops.length);
      scored.push({ row, score: sc, ed, svc, opCount: ops.length });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored.slice(0, 3)) {
      fallbackAnchors.push({
        unitId: s.row.live_unit_id,
        name: s.row.name_display,
        anchorScore: s.score,
        scoreBandLabel: scoreBandLabelForHint(s.score),
        entityKind: s.ed.entityKind,
        liveLabel: s.ed.liveLabel,
        reasonSummary: buildReasonSummary(s.row, s.ed, s.svc, s.opCount),
      });
    }
  }

  const debug: ClusterBuildDebug = {
    rowsConsidered: rows.length,
    anchorCandidatesFound: eligibleAnchors.length,
    clustersFormed: clusters.length,
    totalRelatedRowsGrouped,
    fallbackAnchors,
  };

  return { clusters, debug };
}
