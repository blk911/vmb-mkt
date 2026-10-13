import type { CandidateProfile, ProfileLink, ProfileRefinementStatus } from "./profile-types";

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

export type RefinementQueueItem = { reviewKey: string; nextAttemptAt?: string; eligible: boolean };

export function toRefinementQueueItem(row: import("./types").ValidationReviewRow): RefinementQueueItem {
  const terminal = new Set(["approved", "merged", "rejected", "failed", "dismissed"]);
  const links = row.profile ? [...row.profile.bookingLinks, ...row.profile.websiteLinks, ...row.profile.socialLinks] : [];
  return {
    reviewKey: row.reviewKey,
    nextAttemptAt: row.profile?.nextAttemptAt,
    eligible: !terminal.has(row.status) && !row.lanes.some((lane) => terminal.has(row.laneStatuses[lane] || ""))
      && links.some((link) => link.kind !== "directory" && Boolean(safeProfileHref(link.url))),
  };
}
