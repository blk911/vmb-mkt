export type ExternalSourceType = "glossgenius" | "vagaro" | "square" | "other";

export interface ExternalSiteCaptureRequest {
  url: string;
  sourceType: ExternalSourceType;
}

export interface ExternalSiteRawResult {
  url: string;
  finalUrl: string;
  html: string;
  title?: string;
  metaDescription?: string;
  fetchedAt: string;
}

export interface ExtractedServiceRecord {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  priceLabel?: string;
  durationLabel?: string;
  imageUrl?: string;
}

export interface ExtractedProviderRecord {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  imageUrl?: string;
}

export interface ExtractedBusinessProfile {
  businessName?: string;
  sourceType: ExternalSourceType;
  sourceUrl: string;
  bookingUrl?: string;
  heroImageUrl?: string;
  logoImageUrl?: string;
  services: ExtractedServiceRecord[];
  providers: ExtractedProviderRecord[];
  socialLinks: {
    instagramUrl?: string;
    facebookUrl?: string;
    tiktokUrl?: string;
  };
  contact: {
    phone?: string;
    address?: string;
  };
  ctaLinks: string[];
  imageUrls: string[];
  textBlocks: string[];
  serviceNames: string[];
  providerNames: string[];
  filteredDuplicateTextBlocksCount: number;
}

export interface VmbMappedProfile {
  hero: {
    title: string;
    subtitle?: string;
    sourceUrl: string;
    bookingUrl?: string;
    heroImageUrl?: string;
    instagramUrl?: string;
  };
  serviceCards: Array<{
    id: string;
    title: string;
    subtitle?: string;
    priceLabel?: string;
    durationLabel?: string;
    imageUrl?: string;
  }>;
  favoriteCards: Array<{
    id: string;
    title: string;
    category?: string;
    imageUrl?: string;
  }>;
  clientLoveBlock: {
    headline: string;
    body: string;
  };
  portfolioImages: string[];
  referralBlock: {
    headline: string;
    body: string;
  };
  giftBlock: {
    headline: string;
    body: string;
  };
  networkBlock: {
    headline: string;
    body: string;
  };
  parseConfidence: "High" | "Medium" | "Low";
  diagnostics: string[];
}

export interface ExternalSiteCaptureSnapshot {
  id: string;
  createdAt: string;
  request: ExternalSiteCaptureRequest;
  raw: ExternalSiteRawResult;
  extracted: ExtractedBusinessProfile;
  mapped: VmbMappedProfile;
}

export type ExternalSiteCaptureResponse = {
  ok: true;
  request: ExternalSiteCaptureRequest;
  raw: ExternalSiteRawResult;
  extracted: ExtractedBusinessProfile;
  mapped: VmbMappedProfile;
} | {
  ok: false;
  error: string;
};

export type MappingControlState = {
  buildHero: boolean;
  buildServiceCards: boolean;
  buildFavoriteCards: boolean;
  buildReferralBlock: boolean;
  buildGiftBlock: boolean;
  buildPortfolioGrid: boolean;
};
