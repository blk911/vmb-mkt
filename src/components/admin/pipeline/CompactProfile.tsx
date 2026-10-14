import type { CandidateProfile } from "@/lib/admin/pipeline/profile-types";
import { profilePlatformLabels, profilePlatformExplanation, profileStatusLabel, profileFreshnessLabel } from "@/lib/admin/pipeline/profile-presentation";

/** Presentation only: missing evidence is never a negative finding. */
export function compactText(value?: string): string {
  const text = value?.trim();
  return !text || /^(unknown|unkwn|not collected|not recorded)$/i.test(text) ? "Unkwn" : text;
}

export function CompactValue({ value }: { value?: string }) {
  const text = compactText(value);
  return <span title={text === "Unkwn" ? "Unknown: no attributable value collected" : text} className={text === "Unkwn" ? "text-gray-500" : undefined}>{text}</span>;
}

export function CompactPlatform({ profile }: { profile?: CandidateProfile }) {
  const labels = profilePlatformLabels(profile);
  return <span title={profilePlatformExplanation(profile)} className={labels.length ? "font-medium" : "text-gray-500"}>{labels.join(" + ") || "Unkwn"}</span>;
}

export function compactReviewStatus(status?: string): { label: string; description: string; tone: "positive" | "negative" | "review" | "neutral" } {
  switch (status) {
    case "approved": return { label: "✓", description: "Review approved. This is not license verification.", tone: "positive" };
    case "rejected": return { label: "✕", description: "Review rejected. This does not mean unlicensed.", tone: "negative" };
    case "merged": return { label: "Merged", description: "Review merged into an existing target", tone: "neutral" };
    case "conflict": case "partially_reviewed": return { label: "Review", description: status.replaceAll("_", " "), tone: "review" };
    case "pending": case "queued": return { label: "Pending", description: "Awaiting review", tone: "neutral" };
    default: return { label: compactText(status?.replaceAll("_", " ")), description: status || "Review status unknown", tone: "neutral" };
  }
}

export function CompactReviewStatus({ status }: { status?: string }) {
  const state = compactReviewStatus(status);
  const color = state.tone === "positive" ? "text-green-800" : state.tone === "negative" ? "text-red-700" : state.tone === "review" ? "text-amber-800" : "text-gray-600";
  return <span className={`inline-block whitespace-nowrap text-xs font-medium ${color}`} title={state.description} aria-label={state.description}>{state.label}</span>;
}

export function CompactProfileCheckState({ profile }: { profile?: CandidateProfile }) {
  const label = !profile || profile.status === "not_checked" ? "Unkwn" : profile.status === "provider_matched" ? "Name found" : profile.status === "directory_linked" ? "Linked" : profile.status === "shared_page_only" ? "Shared" : "Review";
  return <span className={`whitespace-nowrap text-xs ${label === "Review" ? "text-amber-800" : "text-gray-600"}`} title={`${profileStatusLabel(profile)} · ${profileFreshnessLabel(profile)}${profile?.lastAttemptAt ? ` · Checked ${profile.lastAttemptAt}` : ""}`}>{label}</span>;
}
