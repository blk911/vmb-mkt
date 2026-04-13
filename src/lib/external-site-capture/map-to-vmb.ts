import type { ExtractedBusinessProfile, VmbMappedProfile } from "./types";

function slugify(input: string, fallback: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function mapExtractedProfileToVmbProfile(profile: ExtractedBusinessProfile): VmbMappedProfile {
  const diagnostics: string[] = [];

  if (!profile.businessName) diagnostics.push("missing business name");
  if (!profile.heroImageUrl) diagnostics.push("missing hero image");
  if (profile.services.length < 3) diagnostics.push("low service count");
  if (!profile.providers.length) diagnostics.push("no providers found");
  if (!profile.socialLinks.instagramUrl && !profile.socialLinks.facebookUrl && !profile.socialLinks.tiktokUrl) {
    diagnostics.push("no social links found");
  }
  if (!profile.bookingUrl) diagnostics.push("no booking link found");
  if (!profile.imageUrls.length) diagnostics.push("no portfolio images found");
  if (profile.bookingUrl && !profile.services.length) diagnostics.push("booking link found but no services found");
  if (profile.filteredDuplicateTextBlocksCount >= 8) diagnostics.push("too many duplicate text blocks filtered");

  let parseConfidence: "High" | "Medium" | "Low" = "Low";
  if (profile.businessName && profile.bookingUrl && profile.services.length >= 3 && profile.imageUrls.length >= 1) {
    parseConfidence = "High";
  } else if (profile.businessName && (profile.services.length > 0 || profile.providers.length > 0 || profile.imageUrls.length > 0)) {
    parseConfidence = "Medium";
  }
  if (parseConfidence === "Low") diagnostics.push("likely weak parse confidence");

  return {
    hero: {
      title: profile.businessName || "Imported Salon Profile",
      subtitle:
        profile.services.length > 0
          ? "Imported from GlossGenius with services and booking links"
          : profile.contact.address || profile.textBlocks[0] || "Imported from external salon source",
      sourceUrl: profile.sourceUrl,
      bookingUrl: profile.bookingUrl,
      heroImageUrl: profile.heroImageUrl,
      instagramUrl: profile.socialLinks.instagramUrl,
    },
    serviceCards: profile.services.map((service, index) => ({
      id: service.id || `${slugify(service.title, `service-${index + 1}`)}`,
      title: service.title,
      subtitle: service.subtitle || service.description,
      priceLabel: service.priceLabel,
      durationLabel: service.durationLabel,
      imageUrl: service.imageUrl,
    })),
    favoriteCards: profile.providers.map((provider, index) => ({
      id: provider.id || `${slugify(provider.name, `provider-${index + 1}`)}`,
      title: provider.name,
      category: provider.title || "Provider",
      imageUrl: provider.imageUrl,
    })),
    portfolioImages: profile.imageUrls,
    clientLoveBlock: {
      headline: "Clients don’t shop. They keep their favorites.",
      body: "VMB helps turn trusted relationships into visible referral momentum.",
    },
    referralBlock: {
      headline: "Your clients already promote their favorites every day.",
      body: "VMB helps turn that into a referral network.",
    },
    giftBlock: {
      headline: "VMB Salon Treat",
      body: "Make sharing favorites easy.",
    },
    networkBlock: {
      headline: "She already built the network.",
      body: "VMB helps connect it.",
    },
    parseConfidence,
    diagnostics,
  };
}
