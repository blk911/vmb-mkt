import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "./types";
import type { OperatorReviewRecord, OperatorReviewState } from "./review-types";
import { loadResolverRegistry } from "@/lib/resolver/registry-store";
import type { ResolverOperator } from "@/lib/resolver/types";

const REVIEW_FILE_PATH = path.join(process.cwd(), "runtime-data/operator_review_states.json");

function ensureRuntimeDir() {
  fs.mkdirSync(path.dirname(REVIEW_FILE_PATH), { recursive: true });
}

export function loadOperatorReviews(): OperatorReviewRecord[] {
  if (!fs.existsSync(REVIEW_FILE_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(REVIEW_FILE_PATH, "utf-8")) as unknown;
  return Array.isArray(parsed) ? (parsed as OperatorReviewRecord[]) : [];
}

function saveOperatorReviews(rows: OperatorReviewRecord[]) {
  ensureRuntimeDir();
  fs.writeFileSync(REVIEW_FILE_PATH, `${JSON.stringify(rows, null, 2)}\n`);
}

function upsertReview(
  operatorId: string,
  patch: Partial<Pick<OperatorReviewRecord, "reviewState" | "reviewNotes">>
): OperatorReviewRecord {
  const rows = loadOperatorReviews();
  const now = new Date().toISOString();
  const idx = rows.findIndex((row) => row.operatorId === operatorId);
  const current = idx >= 0 ? rows[idx] : undefined;
  const next: OperatorReviewRecord = {
    operatorId,
    reviewState: patch.reviewState ?? current?.reviewState ?? "unreviewed",
    reviewNotes: patch.reviewNotes ?? current?.reviewNotes,
    updatedAt: now,
  };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  saveOperatorReviews(rows);
  return next;
}

export function markReady(operatorId: string): OperatorReviewRecord {
  return upsertReview(operatorId, { reviewState: "ready" });
}

export function shelveByReview(operatorId: string): OperatorReviewRecord {
  return upsertReview(operatorId, { reviewState: "shelved_by_review" });
}

export function addReviewNote(operatorId: string, note: string): OperatorReviewRecord {
  return upsertReview(operatorId, { reviewNotes: note });
}

export function applyReviewOverlay(operators: OperatorRecord[]): OperatorRecord[] {
  const reviews = loadOperatorReviews();
  const reviewMap = new Map(reviews.map((row) => [row.operatorId, row]));
  return operators.map((op) => {
    const review = reviewMap.get(op.id);
    if (!review) return { ...op, reviewState: op.reviewState ?? "unreviewed" };
    return {
      ...op,
      reviewState: review.reviewState,
      reviewNotes: review.reviewNotes,
    };
  });
}

export function resolverOperatorToOperatorRecord(op: ResolverOperator): OperatorRecord {
  const sources: OperatorRecord["sources"] = {};
  for (const row of op.sources || []) {
    sources[row.source] = {
      source: row.source,
      sourceUrl: row.sourceUrl,
      name: row.name,
      city: row.city,
      category: row.category,
      address: row.address,
      phone: row.phone,
      website: row.website,
      instagram: row.instagram,
      booking: row.booking,
      parentContainerName: row.parentContainerName,
      evidenceType: row.evidenceType,
      childQuerySeeds: row.childQuerySeeds,
      raw: row.raw,
      extracted: row.extracted,
    };
  }
  return {
    id: op.id,
    name: op.canonicalName || "unknown",
    city: op.canonicalCity,
    category: op.category,
    sources,
    evidence: op.sources.map((row) => ({
      source: row.source,
      sourceUrl: row.sourceUrl,
      name: row.name,
      city: row.city,
      category: row.category,
      address: row.address,
      phone: row.phone,
      website: row.website,
      instagram: row.instagram,
      booking: row.booking,
      parentContainerName: row.parentContainerName,
      evidenceType: row.evidenceType,
      childQuerySeeds: row.childQuerySeeds,
      raw: row.raw,
      extracted: row.extracted,
    })),
    canonical: {
      instagram: op.canonicalInstagram,
      booking: op.canonicalBooking,
      website: op.canonicalWebsite,
      phone: op.canonicalPhone,
    },
    validation: {
      instagramStatus: op.canonicalInstagram ? "valid" : "missing",
      bookingStatus: op.canonicalBooking ? "valid" : "missing",
      websiteStatus: op.canonicalWebsite ? "valid" : "missing",
    },
    status: op.status === "hot" || op.status === "ready" ? "hot" : op.status === "shelved" ? "shelved" : "discard",
    reviewState: op.reviewState,
    reviewNotes: op.reviewNotes,
    preferredContactSurface: op.preferredContactSurface,
    normalizedCategory: op.normalizedCategory,
    confidenceScore: op.confidenceScore,
    lastUpdatedAt: new Date(op.updatedAt).toISOString(),
  };
}

export function loadResolverBackedOperatorsWithReview(): OperatorRecord[] {
  const resolverOperators = loadResolverRegistry();
  const mapped = resolverOperators.map(resolverOperatorToOperatorRecord);
  return applyReviewOverlay(mapped);
}

export function getReviewStateOrDefault(state?: OperatorReviewState): OperatorReviewState {
  return state ?? "unreviewed";
}

