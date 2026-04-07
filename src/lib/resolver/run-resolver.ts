import crypto from "node:crypto";
import type { EvidenceRecord } from "@/lib/evidence/types";
import { loadEvidence } from "@/lib/evidence/store";
import { expandContainerEvidence } from "./container-expansion";
import { evaluateEvidenceMatch } from "./match";
import { normalizeAddress, normalizeCity, normalizeDomain, normalizeName, normalizePhone } from "./normalize";
import { loadResolverRegistry, saveResolverRegistry, saveResolverSummary } from "./registry-store";
import type { ResolverOperator } from "./types";
import { loadOperatorReviews } from "@/lib/operators/review-store";

function operatorIdFromEvidence(e: EvidenceRecord): string {
  const key = [
    normalizeName(e.name),
    normalizeAddress(e.address),
    normalizePhone(e.phone),
    normalizeDomain(e.website || e.booking || e.instagram),
  ].join("|");
  return crypto.createHash("md5").update(key || `${e.id}`).digest("hex");
}

function normalizeEvidence(e: EvidenceRecord): EvidenceRecord {
  return {
    ...e,
    name: e.name?.trim() || e.name,
    address: e.address?.trim() || e.address,
    city: normalizeCity(e.city) || e.city,
    phone: normalizePhone(e.phone) || e.phone,
  };
}

function createOperatorFromEvidence(e: EvidenceRecord, now: number): ResolverOperator {
  const parentContainerId = e.parentContainerName
    ? crypto.createHash("md5").update(normalizeName(e.parentContainerName)).digest("hex")
    : undefined;
  return {
    id: operatorIdFromEvidence(e),
    canonicalName: e.name,
    canonicalAddress: e.address,
    canonicalCity: e.city,
    canonicalPhone: e.phone,
    canonicalWebsite: e.website,
    canonicalInstagram: e.instagram,
    canonicalBooking: e.booking,
    category: inferCategory(e) || e.category,
    sources: [e],
    confidenceScore: 1,
    status: "enumerated",
    isContainer: e.evidenceType === "suite_container",
    parentContainerId,
    createdAt: now,
    updatedAt: now,
  };
}

function inferCategory(e: EvidenceRecord): string | undefined {
  const rawCategory =
    e.raw && typeof e.raw === "object" && "category" in (e.raw as Record<string, unknown>)
      ? String((e.raw as Record<string, unknown>).category || "")
      : "";
  const text = [e.name || "", rawCategory].join(" ").toLowerCase();
  if (text.includes("nail")) return "nails";
  if (text.includes("lash")) return "lashes";
  if (text.includes("brow")) return "brows";
  if (text.includes("hair")) return "hair";
  if (text.includes("spa")) return "spa";
  return undefined;
}

function deriveNormalizedCategory(op: ResolverOperator): ResolverOperator["normalizedCategory"] {
  const text = [op.category || "", op.canonicalName || ""].join(" ").toLowerCase();
  const hasNails = text.includes("nail");
  const hasLashes = text.includes("lash");
  const hasBrows = text.includes("brow");
  const hasHair = text.includes("hair") || text.includes("barber");
  const hasSpa = text.includes("spa") || text.includes("esthetic");
  const hits = [hasNails, hasLashes, hasBrows, hasHair, hasSpa].filter(Boolean).length;
  if (hits > 1) return "multi_service";
  if (hasNails) return "nails";
  if (hasLashes) return "lashes";
  if (hasBrows) return "brows";
  if (hasHair) return "hair";
  if (hasSpa) return "spa";
  return "unknown";
}

function derivePreferredContactSurface(op: ResolverOperator): ResolverOperator["preferredContactSurface"] {
  if (op.canonicalBooking) return "booking";
  if (op.canonicalInstagram) return "instagram";
  if (op.canonicalWebsite) return "website";
  if (op.canonicalPhone) return "phone";
  return "none";
}

function sourcePriority(source: EvidenceRecord["source"]): number {
  if (source === "booking") return 6;
  if (source === "website") return 5;
  if (source === "instagram") return 4;
  if (source === "directory") return 3;
  if (source === "google") return 2;
  if (source === "dora") return 2;
  if (source === "container") return 1;
  return 1;
}

function updateCanonical(op: ResolverOperator): void {
  const sorted = [...op.sources].sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source));
  const pick = <K extends keyof EvidenceRecord>(field: K): EvidenceRecord[K] | undefined =>
    sorted.find((x) => Boolean(x[field]))?.[field];

  op.canonicalBooking = (pick("booking") as string | undefined) || op.canonicalBooking;
  op.canonicalWebsite = (pick("website") as string | undefined) || op.canonicalWebsite;
  op.canonicalInstagram = (pick("instagram") as string | undefined) || op.canonicalInstagram;
  op.canonicalPhone = (pick("phone") as string | undefined) || op.canonicalPhone;
  op.canonicalName = (pick("name") as string | undefined) || op.canonicalName;
  op.canonicalAddress = (pick("address") as string | undefined) || op.canonicalAddress;
  op.canonicalCity = (pick("city") as string | undefined) || op.canonicalCity;
}

function scoreOperator(op: ResolverOperator): number {
  let score = 0;
  if (op.canonicalBooking) score += 5;
  if (op.canonicalInstagram) score += 4;
  if (op.canonicalWebsite) score += 3;
  if (op.canonicalPhone) score += 2;
  score += Math.min(8, op.sources.length);
  return score;
}

function assignStatus(op: ResolverOperator): ResolverOperator["status"] {
  if (op.isContainer) return "shelved";
  const hasBooking = Boolean(op.canonicalBooking);
  const hasStrongIG = Boolean(op.canonicalInstagram && op.canonicalName && op.canonicalCity);
  if (hasBooking || hasStrongIG) return "hot";
  const hasIdentity = Boolean(op.canonicalName && (op.canonicalCity || op.canonicalAddress));
  if (hasIdentity && (op.canonicalWebsite || op.canonicalPhone || op.sources.length >= 3)) return "enriched";
  return "enumerated";
}

function overlayReviews(operators: ResolverOperator[]): ResolverOperator[] {
  const reviews = loadOperatorReviews();
  const map = new Map(reviews.map((x) => [x.operatorId, x]));
  return operators.map((op) => {
    const row = map.get(op.id);
    if (!row) return { ...op, reviewState: op.reviewState ?? "unreviewed" };
    return {
      ...op,
      reviewState: row.reviewState,
      reviewNotes: row.reviewNotes,
    };
  });
}

function overlayPromotionFields(operators: ResolverOperator[]): ResolverOperator[] {
  const previous = loadResolverRegistry();
  const map = new Map(previous.map((x) => [x.id, x]));
  return operators.map((op) => {
    const prior = map.get(op.id);
    if (!prior) return { ...op, promotionState: op.promotionState ?? "untried" };
    return {
      ...op,
      promotionScore: op.promotionScore ?? prior.promotionScore,
      promotionReasons: op.promotionReasons ?? prior.promotionReasons,
      promotionState: op.promotionState ?? prior.promotionState ?? "untried",
    };
  });
}

export function runResolverFromEvidence(inputEvidence?: EvidenceRecord[]): ResolverOperator[] {
  const now = Date.now();
  const rawEvidence = inputEvidence || loadEvidence();
  const evidence = expandContainerEvidence(rawEvidence.map(normalizeEvidence));

  const operators: ResolverOperator[] = [];

  for (const row of evidence) {
    let bestMatch: ResolverOperator | undefined;
    let bestScore = -1;
    for (const op of operators) {
      const evaluation = evaluateEvidenceMatch(op, row);
      if (evaluation.score > bestScore) {
        bestScore = evaluation.score;
        bestMatch = op;
      }
    }

    if (bestMatch && evaluateEvidenceMatch(bestMatch, row).matched) {
      bestMatch.sources.push(row);
      bestMatch.confidenceScore = Math.max(bestMatch.confidenceScore, Math.floor(bestScore / 10));
      bestMatch.updatedAt = now;
      continue;
    }

    operators.push(createOperatorFromEvidence(row, now));
  }

  for (const op of operators) {
    updateCanonical(op);
    op.confidenceScore = Math.max(op.confidenceScore, scoreOperator(op));
    op.normalizedCategory = deriveNormalizedCategory(op);
    op.preferredContactSurface = derivePreferredContactSurface(op);
    op.status = assignStatus(op);
    op.updatedAt = now;
  }

  const withReviews = overlayReviews(operators).map((op) => {
    if (op.reviewState === "ready") return { ...op, status: "ready" as const };
    if (op.reviewState === "shelved_by_review") return { ...op, status: "shelved" as const };
    return op;
  });
  const withPromotion = overlayPromotionFields(withReviews);
  saveResolverRegistry(withPromotion);
  saveResolverSummary({ evidenceCount: rawEvidence.length, operators: withPromotion });
  return withPromotion;
}

export function runResolver(): ResolverOperator[] {
  return runResolverFromEvidence();
}

