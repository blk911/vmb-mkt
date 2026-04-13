import type { ImportedProfileReviewState } from "@/lib/external-site-review/types";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";

export function buildInitialReview(
  draft: Pick<
    ImportedProfileDraft,
    | "businessName"
    | "subtitle"
    | "bookingUrl"
    | "instagramUrl"
    | "heroImageUrl"
    | "services"
    | "providers"
    | "portfolioImages"
    | "referralBlock"
    | "giftBlock"
    | "networkBlock"
  >
): ImportedProfileReviewState {
  return {
    payload: {
      businessName: draft.businessName,
      subtitle: draft.subtitle,
      bookingUrl: draft.bookingUrl,
      instagramUrl: draft.instagramUrl,
      heroImageUrl: draft.heroImageUrl,
      services: draft.services.map((service) => ({ ...service })),
      providers: draft.providers.map((provider) => ({ ...provider })),
      portfolioImages: [...draft.portfolioImages],
      referralBlock: { ...draft.referralBlock },
      giftBlock: { ...draft.giftBlock },
      networkBlock: { ...draft.networkBlock },
    },
    hasEdits: false,
  };
}
