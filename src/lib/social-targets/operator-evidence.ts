import { ensureSocialCandidates, getPrimaryCandidate } from "@/lib/social-targets/social-candidate-logic";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { mapProfileHealthToResolveStatus } from "@/lib/social-targets/normalization";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

function platformLabel(p: SocialCandidate["platform"]): string {
  switch (p) {
    case "instagram":
      return "IG";
    case "tiktok":
      return "TikTok";
    case "linktree":
      return "Linktree";
    case "website":
      return "Web";
    case "booking":
      return "Booking";
    default:
      return "Social";
  }
}

/** One short line for table row (no wrap explosion). */
export function buildEvidenceHeadline(t: SocialTarget): string {
  const integrity = getFeaturedValidationIntegrity(t);
  const p = integrity.displayCandidate ?? getPrimaryCandidate(ensureSocialCandidates(t));
  if (!p) return "No profile candidate.";
  const plat = platformLabel(p.platform);
  const rs = integrity.displayResolveState;
  const act = integrity.displayActivityState;
  const parts: string[] = [];
  if (rs === "live") parts.push(`Live ${plat}`);
  else if (rs === "stale") parts.push(`Stale ${plat}`);
  else if (rs === "dead") parts.push(`Dead link (${plat})`);
  else if (rs === "blocked") parts.push(`Blocked check (${plat})`);
  else parts.push(`${rs} (${plat})`);

  if (act === "recent") parts.push("recent activity");
  else if (act === "stale") parts.push("stale activity");
  parts.push(`score ${p.overallConfidenceScore}`);

  return parts.join(" · ");
}

/** Secondary line: component scores + discovery hint. */
export function buildEvidenceDetailLine(t: SocialTarget): string {
  const p = getPrimaryCandidate(ensureSocialCandidates(t));
  if (!p) return "";
  const geo = p.geoMatchScore;
  const cat = p.categoryMatchScore;
  const biz = p.businessMatchScore;
  const src = p.discoverySource.replace(/_/g, " ");
  return `Match: business ${biz} · geo ${geo} · category ${cat} · source ${src}`;
}

/** Tail of stored verification evidence (newest last). */
export function buildEvidenceTail(t: SocialTarget, maxItems = 2): string[] {
  const p = getPrimaryCandidate(ensureSocialCandidates(t));
  const ev = p?.evidence;
  if (!ev?.length) return [];
  return ev.slice(-maxItems);
}

/** Map legacy profile health to a human hint when resolve is unknown. */
export function legacyHealthHint(t: SocialTarget): string | null {
  const p = getPrimaryCandidate(ensureSocialCandidates(t));
  const rs = p?.resolveStatus ?? mapProfileHealthToResolveStatus(t.profileHealth);
  if (rs !== "unknown") return null;
  if (t.profileHealth === "not_found") return "Marked not found in health.";
  if (t.profileHealth === "private") return "Marked private in health.";
  return null;
}
