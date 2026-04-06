import type { OperatorRecord } from "./types";

export function assignStatus(op: OperatorRecord): OperatorRecord {
  const { instagramStatus, bookingStatus, websiteStatus } = op.validation;
  let score = 0;
  if (instagramStatus === "valid") score += 2;
  if (bookingStatus === "valid") score += 3;
  if (websiteStatus === "valid") score += 1;
  op.confidenceScore = score;
  if (score >= 3) {
    op.status = "hot";
  } else if (score >= 1) {
    op.status = "shelved";
  } else {
    op.status = "discard";
  }
  return op;
}
