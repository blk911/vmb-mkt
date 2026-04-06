import type { OperatorRecord } from "./types";

export function rankOperator(op: OperatorRecord): number {
  let score = 0;

  if (op.validation.bookingStatus === "valid") score += 40;
  if (op.validation.instagramStatus === "valid") score += 30;
  if (op.validation.websiteStatus === "valid") score += 10;

  if (op.canonical.booking && op.canonical.instagram) score += 20;

  score += op.confidenceScore * 5;

  return score;
}
