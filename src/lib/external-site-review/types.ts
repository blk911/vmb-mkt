export interface ImportedProfileReviewPayload {
  businessName: string;
  subtitle?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  heroImageUrl?: string;
  services: Array<{
    id: string;
    title: string;
    subtitle?: string;
    priceLabel?: string;
    durationLabel?: string;
    imageUrl?: string;
  }>;
  providers: Array<{
    id: string;
    name: string;
    title?: string;
    imageUrl?: string;
  }>;
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
}

export interface ImportedProfileReviewState {
  payload: ImportedProfileReviewPayload;
  lastEditedAt?: string;
  hasEdits: boolean;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isServiceArray(value: unknown): value is ImportedProfileReviewPayload["services"] {
  return (
    Array.isArray(value) &&
    value.every((entry) =>
      isObjectRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.title === "string" &&
      isOptionalString(entry.subtitle) &&
      isOptionalString(entry.priceLabel) &&
      isOptionalString(entry.durationLabel) &&
      isOptionalString(entry.imageUrl)
    )
  );
}

function isProviderArray(value: unknown): value is ImportedProfileReviewPayload["providers"] {
  return (
    Array.isArray(value) &&
    value.every((entry) =>
      isObjectRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      isOptionalString(entry.title) &&
      isOptionalString(entry.imageUrl)
    )
  );
}

function isCopyBlock(value: unknown): value is { headline: string; body: string } {
  return isObjectRecord(value) && typeof value.headline === "string" && typeof value.body === "string";
}

export function isImportedProfileReviewPayload(value: unknown): value is ImportedProfileReviewPayload {
  return (
    isObjectRecord(value) &&
    typeof value.businessName === "string" &&
    isOptionalString(value.subtitle) &&
    isOptionalString(value.bookingUrl) &&
    isOptionalString(value.instagramUrl) &&
    isOptionalString(value.heroImageUrl) &&
    isServiceArray(value.services) &&
    isProviderArray(value.providers) &&
    isStringArray(value.portfolioImages) &&
    isCopyBlock(value.referralBlock) &&
    isCopyBlock(value.giftBlock) &&
    isCopyBlock(value.networkBlock)
  );
}
