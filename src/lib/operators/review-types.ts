export type OperatorReviewState = "unreviewed" | "ready" | "shelved_by_review";

export type OperatorReviewAction = "markReady" | "shelveByReview" | "addReviewNote";

export type OperatorReviewRecord = {
  operatorId: string;
  reviewState: OperatorReviewState;
  reviewNotes?: string;
  updatedAt: string;
};

