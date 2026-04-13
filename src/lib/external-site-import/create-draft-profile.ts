import crypto from "node:crypto";
import type {
  ExternalSiteCaptureRequest,
  ExtractedBusinessProfile,
  VmbMappedProfile,
} from "@/lib/external-site-capture/types";
import { buildInitialReview } from "@/lib/external-site-review/build-initial-review";
import type { ImportedProfileDraft } from "./types";

function makeId(input: string): string {
  return `ipd_${crypto.createHash("md5").update(input).digest("hex").slice(0, 12)}`;
}

export function createDraftProfileFromCapture(args: {
  request: ExternalSiteCaptureRequest;
  mapped: VmbMappedProfile;
  extracted: ExtractedBusinessProfile;
  sourceSnapshotId?: string;
  parseConfidence?: "High" | "Medium" | "Low";
}): ImportedProfileDraft {
  const createdAt = new Date().toISOString();
  const draft: ImportedProfileDraft = {
    id: makeId(`${args.request.url}|${createdAt}`),
    createdAt,
    updatedAt: createdAt,
    status: "draft",
    sourceType: args.request.sourceType,
    sourceUrl: args.request.url,
    businessName: args.mapped.hero.title || args.extracted.businessName || "Imported Salon Profile",
    subtitle: args.mapped.hero.subtitle,
    bookingUrl: args.mapped.hero.bookingUrl,
    instagramUrl: args.mapped.hero.instagramUrl,
    heroImageUrl: args.mapped.hero.heroImageUrl,
    services: args.mapped.serviceCards.map((service) => ({
      id: service.id,
      title: service.title,
      subtitle: service.subtitle,
      priceLabel: service.priceLabel,
      durationLabel: service.durationLabel,
      imageUrl: service.imageUrl,
    })),
    providers: args.mapped.favoriteCards.map((provider) => ({
      id: provider.id,
      name: provider.title,
      title: provider.category,
      imageUrl: provider.imageUrl,
    })),
    portfolioImages: args.mapped.portfolioImages,
    referralBlock: args.mapped.referralBlock,
    giftBlock: args.mapped.giftBlock,
    networkBlock: args.mapped.networkBlock,
    diagnostics: args.mapped.diagnostics,
    parseConfidence: args.parseConfidence || args.mapped.parseConfidence,
    sourceSnapshotId: args.sourceSnapshotId,
    decisionStatus: "unresolved",
    review: buildInitialReview({
      businessName: args.mapped.hero.title || args.extracted.businessName || "Imported Salon Profile",
      subtitle: args.mapped.hero.subtitle,
      bookingUrl: args.mapped.hero.bookingUrl,
      instagramUrl: args.mapped.hero.instagramUrl,
      heroImageUrl: args.mapped.hero.heroImageUrl,
      services: args.mapped.serviceCards.map((service) => ({
        id: service.id,
        title: service.title,
        subtitle: service.subtitle,
        priceLabel: service.priceLabel,
        durationLabel: service.durationLabel,
        imageUrl: service.imageUrl,
      })),
      providers: args.mapped.favoriteCards.map((provider) => ({
        id: provider.id,
        name: provider.title,
        title: provider.category,
        imageUrl: provider.imageUrl,
      })),
      portfolioImages: args.mapped.portfolioImages,
      referralBlock: args.mapped.referralBlock,
      giftBlock: args.mapped.giftBlock,
      networkBlock: args.mapped.networkBlock,
    }),
  };
  return draft;
}
