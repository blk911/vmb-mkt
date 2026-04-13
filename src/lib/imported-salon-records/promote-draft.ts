import crypto from "node:crypto";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";
import type { ImportedSalonRecord } from "./types";

function recordIdFromDraftId(draftId: string): string {
  return `isr_${crypto.createHash("md5").update(draftId).digest("hex").slice(0, 12)}`;
}

export function promoteDraftToImportedSalonRecord(draft: ImportedProfileDraft): ImportedSalonRecord {
  if (draft.status !== "ready") {
    throw new Error("draft_not_ready");
  }
  if (!draft.review?.payload) {
    throw new Error("draft_review_missing");
  }

  const review = draft.review.payload;
  const createdAt = new Date().toISOString();
  return {
    id: recordIdFromDraftId(draft.id),
    createdAt,
    updatedAt: createdAt,
    status: "active",
    sourceDraftId: draft.id,
    sourceType: draft.sourceType,
    sourceUrl: draft.sourceUrl,
    businessName: review.businessName,
    subtitle: review.subtitle,
    bookingUrl: review.bookingUrl,
    instagramUrl: review.instagramUrl,
    heroImageUrl: review.heroImageUrl,
    services: review.services.map((service) => ({ ...service })),
    providers: review.providers.map((provider) => ({ ...provider })),
    portfolioImages: [...review.portfolioImages],
    referralBlock: { ...review.referralBlock },
    giftBlock: { ...review.giftBlock },
    networkBlock: { ...review.networkBlock },
    diagnostics: draft.diagnostics,
    parseConfidence: draft.parseConfidence,
    decisionStatus: "unresolved",
  };
}
