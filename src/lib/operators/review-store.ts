import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "./types";
import type { OperatorReviewRecord, OperatorReviewState } from "./review-types";

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

export function getReviewStateOrDefault(state?: OperatorReviewState): OperatorReviewState {
  return state ?? "unreviewed";
}

