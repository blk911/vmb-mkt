import {
  sourceCandidateInputToSocialCandidate,
} from "@/lib/social-targets/social-candidate-logic";
import { adaptDoraRecord } from "@/lib/social-targets/source-adapters/dora";
import { adaptGoogleMapsRecord } from "@/lib/social-targets/source-adapters/google-maps";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters/types";
import { adaptWebsiteRecord } from "@/lib/social-targets/source-adapters/website";
import { adaptYelpRecord } from "@/lib/social-targets/source-adapters/yelp";
import type { SocialCandidate, SocialTarget } from "@/types/social-target";

export type SourceIntakeStatus =
  | "already_present"
  | "duplicate"
  | "new_candidate"
  | "rejected_previously"
  | "hidden_previously";

export type ClassifiedSourceCandidate = {
  status: SourceIntakeStatus;
  existingCandidateId?: string;
  previewCandidate: SocialCandidate;
};

function candidateIdentityKey(c: SocialCandidate): string {
  const platform = c.platform || "unknown";
  const handle = (c.handle ?? "").trim().toLowerCase();
  const url = (c.url ?? "").trim().toLowerCase();
  return `${platform}|${handle}|${url}`;
}

function sourceInputIdentityKey(input: SourceCandidateInput): string {
  const platform = input.platform || "unknown";
  const handle = (input.handle ?? "").trim().toLowerCase();
  const url = (input.profileUrl ?? "").trim().toLowerCase();
  return `${platform}|${handle}|${url}`;
}

/**
 * Build a small review list of source-adapted candidates from current row evidence.
 * This is intentionally narrow and does not crawl or expand discovery.
 */
export function buildSourceIntakeInputsForTarget(t: SocialTarget): SourceCandidateInput[] {
  const out: SourceCandidateInput[] = [];
  const websiteHint =
    t.socialProfile?.url ||
    (t.socialCandidates ?? []).find((c) => c.platform === "website" || c.platform === "booking")?.url;
  const yelpHint = (t.socialCandidates ?? []).find((c) => (c.url ?? "").toLowerCase().includes("yelp.com"))?.url;
  const hasDoraTag = (t.tags ?? []).some((tag) => tag.toLowerCase().includes("dora"));

  out.push(
    ...adaptGoogleMapsRecord({
      id: t.id,
      name: t.businessName,
      zone: t.zone,
      category: t.category,
      city: t.zone,
      website: websiteHint,
      is_anchor: true,
    })
  );

  out.push(
    ...adaptWebsiteRecord({
      id: t.id,
      businessName: t.businessName,
      zone: t.zone,
      category: t.category,
      website: websiteHint,
      profileUrl: t.socialProfile?.url,
      instagram_handle: t.handle,
    })
  );

  if (yelpHint) {
    out.push(
      ...adaptYelpRecord({
        id: `${t.id}-yelp`,
        name: t.businessName,
        category: t.category,
        yelp_url: yelpHint,
      })
    );
  }

  if (hasDoraTag) {
    out.push(
      ...adaptDoraRecord({
        id: `${t.id}-dora`,
        businessName: t.businessName,
        category: t.category,
        city: t.zone,
      })
    );
  }

  const byKey = new Map<string, SourceCandidateInput>();
  for (const input of out) {
    const key = sourceInputIdentityKey(input);
    if (!key || key === "unknown||") continue;
    if (!byKey.has(key)) byKey.set(key, input);
  }
  return [...byKey.values()];
}

export function classifySourceCandidate(target: SocialTarget, input: SourceCandidateInput): ClassifiedSourceCandidate {
  const preview = sourceCandidateInputToSocialCandidate(target, input);
  const existing = target.socialCandidates ?? [];
  const exactId = existing.find((c) => c.id === preview.id);
  if (exactId) {
    if (exactId.verificationStatus === "rejected") {
      return { status: "rejected_previously", existingCandidateId: exactId.id, previewCandidate: exactId };
    }
    if (exactId.visibilityState === "hide") {
      return { status: "hidden_previously", existingCandidateId: exactId.id, previewCandidate: exactId };
    }
    return { status: "already_present", existingCandidateId: exactId.id, previewCandidate: exactId };
  }

  const key = candidateIdentityKey(preview);
  const dup = existing.find((c) => candidateIdentityKey(c) === key);
  if (dup) {
    if (dup.verificationStatus === "rejected") {
      return { status: "rejected_previously", existingCandidateId: dup.id, previewCandidate: dup };
    }
    if (dup.visibilityState === "hide") {
      return { status: "hidden_previously", existingCandidateId: dup.id, previewCandidate: dup };
    }
    return { status: "duplicate", existingCandidateId: dup.id, previewCandidate: dup };
  }
  return { status: "new_candidate", previewCandidate: preview };
}

