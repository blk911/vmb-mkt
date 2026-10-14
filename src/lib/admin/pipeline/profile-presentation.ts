import type { BookingPlatform, CandidateProfile, ProfileLink, ProfileRefinementStatus } from "./profile-types";

/** Source URLs are data. Never render executable schemes or credential-bearing links. */
export function safeProfileHref(value?: string): string | undefined {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function profileLinkLabel(link: ProfileLink): string {
  if (link.kind === "shared_business" || link.attribution === "business") return "Shared salon / staff";
  if (link.kind === "individual") return "Individual page";
  if (link.kind === "directory") return "Directory listing";
  if (link.kind === "social") return "Social account";
  if (link.kind === "website") return "Website";
  return "Attribution unresolved";
}

const statusLabels: Record<ProfileRefinementStatus, string> = {
  not_checked: "Not checked",
  directory_linked: "Source-linked profile",
  provider_matched: "Name matched in page",
  shared_page_only: "Shared salon / staff only",
  ambiguous: "Attribution ambiguous",
  unmatched: "Provider unmatched",
  blocked: "Protected / access blocked",
  unavailable: "Source unavailable",
  unsupported: "Check unsupported",
  error: "Check failed",
};

export function profileStatusLabel(profile?: CandidateProfile): string {
  return profile ? statusLabels[profile.status] || "Status unknown" : "Not checked";
}

export function profileFreshnessLabel(profile?: CandidateProfile): string {
  if (profile?.freshness === "current_check") return "Source checked";
  if (profile?.freshness === "stale") return "Previous check is stale";
  if (profile?.freshness === "source_reported") return "Source-reported";
  return "Source not checked";
}

const platformNames: Record<BookingPlatform, string> = {
  vagaro: "Vagaro", glossgenius: "GlossGenius", booksy: "Booksy", fresha: "Fresha", square: "Square", styleseat: "StyleSeat", unknown: "Unknown",
};

/** One domain set drives catalog facets, queue sorting and every profile label. */
export function profileKnownPlatforms(profile?: CandidateProfile): BookingPlatform[] {
  if (!profile) return [];
  const values = profile.knownPlatforms || [...profile.bookingLinks.filter((link) => link.attribution !== "unresolved").map((link) => link.platform), profile.platform];
  return [...new Set(values.filter((value): value is BookingPlatform => Boolean(value && value !== "unknown")))].sort();
}

export function profilePlatformLabels(profile?: CandidateProfile): string[] {
  return profileKnownPlatforms(profile).map((platform) => platformNames[platform] || platform);
}

export function profilePlatformLabel(profile?: CandidateProfile): string {
  const labels = profilePlatformLabels(profile);
  return labels.length ? labels.join(" + ") : profile?.observedPlatforms?.length ? "Platform attribution unresolved" : profile?.bookingLinks.length ? "Platform not recognized" : "Platform not collected";
}

export function profilePlatformExplanation(profile?: CandidateProfile): string {
  return profileKnownPlatforms(profile).length ? "Platform recognized · person match is separate" : profile?.observedPlatforms?.length ? "Observed domains need source ownership review" : "No supported booking domain collected";
}

export function profileMissingLinkLabel(profile: CandidateProfile | undefined, kind: "booking" | "social" = "booking"): string {
  if ((kind === "booking" ? profile?.bookingLinks : profile?.socialLinks)?.some((link) => link.attribution === "unresolved")) return `${kind === "booking" ? "Booking" : "Social"} attribution unresolved`;
  return `${kind === "booking" ? "Booking" : "Social"} link not collected`;
}

export function profileFactCoverage(profile?: CandidateProfile): { collected: number; total: number; conflicts: number } {
  const fields = ["providerName", "businessName", "city", "state", "postalCode", "providerId", "businessId"] as const;
  const collected = profile ? fields.filter((field) => Boolean(profile[field])).length
    + Number(Boolean(profile.bookingLinks.length)) + Number(Boolean(profile.socialLinks.length)) + Number(Boolean(profile.websiteLinks.length)) : 0;
  const conflicts = profile?.reasons.filter((reason) => /conflict|differs|ambiguous/i.test(reason)).length || 0;
  return { collected, total: fields.length + 3, conflicts };
}

export type RefinementQueueItem = { reviewKey: string; nextAttemptAt?: string; eligible: boolean };

export function toRefinementQueueItem(row: Pick<import("./types").ValidationReviewRow, "reviewKey" | "profile">): RefinementQueueItem {
  const links = row.profile ? [...row.profile.bookingLinks, ...row.profile.websiteLinks] : [];
  return {
    reviewKey: row.reviewKey,
    nextAttemptAt: row.profile?.nextAttemptAt,
    // Evidence refresh is independent of approval, rejection and merged lanes.
    // Social and directory URLs are deliberately unsupported by public retrieval.
    eligible: links.some((link) => !["directory", "social"].includes(link.kind) && Boolean(safeProfileHref(link.url))),
  };
}
