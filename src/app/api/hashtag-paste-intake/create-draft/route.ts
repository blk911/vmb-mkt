import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildInitialReview } from "@/lib/external-site-review/build-initial-review";
import { appendImportedProfileDraft } from "@/lib/external-site-import/store";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";
import type { ProviderCandidate, HashtagPasteIntakeRequest } from "@/lib/hashtag-paste-intake/types";

export const runtime = "nodejs";

function buildDraftId(input: string): string {
  return `ipd_${crypto.createHash("md5").update(input).digest("hex").slice(0, 12)}`;
}

function buildInstagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, "").trim().toLowerCase()}/`;
}

export async function POST(req: Request) {
  let body: { request?: HashtagPasteIntakeRequest; candidate?: ProviderCandidate };
  try {
    body = (await req.json()) as { request?: HashtagPasteIntakeRequest; candidate?: ProviderCandidate };
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (!body.request || !body.candidate?.handle) {
    return NextResponse.json({ ok: false as const, error: "request_and_candidate_required" }, { status: 400 });
  }

  try {
    const createdAt = new Date().toISOString();
    const handle = body.candidate.handle.replace(/^@/, "").trim().toLowerCase();
    const instagramUrl = buildInstagramUrl(handle);
    const businessName = body.candidate.displayName?.trim() || `@${handle}`;
    const serviceTitle = body.candidate.serviceHint || body.request.serviceHint || "Manual Social Intake";
    const subtitleParts = [body.request.geoHint, body.request.hashtag].filter(Boolean);

    // Manual hashtag paste intake has partial evidence, so we map only the fields we
    // can defend and keep the rest intentionally minimal.
    const draft: ImportedProfileDraft = {
      id: buildDraftId(`${handle}|${createdAt}`),
      createdAt,
      updatedAt: createdAt,
      status: "draft",
      sourceType: "other",
      sourceUrl: instagramUrl,
      businessName,
      subtitle: subtitleParts.length ? subtitleParts.join(" · ") : "Created from manual hashtag paste intake",
      bookingUrl: undefined,
      instagramUrl,
      heroImageUrl: undefined,
      services: [
        {
          id: `service_${crypto.createHash("md5").update(serviceTitle).digest("hex").slice(0, 8)}`,
          title: serviceTitle,
          subtitle: "Manual hashtag evidence",
        },
      ],
      providers: [
        {
          id: `provider_${crypto.createHash("md5").update(handle).digest("hex").slice(0, 8)}`,
          name: businessName,
          title: body.candidate.serviceHint || body.request.serviceHint,
        },
      ],
      portfolioImages: [],
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
      diagnostics: [
        "Created from manual hashtag paste intake",
        `provider candidate confidence: ${body.candidate.confidence}`,
        `evidence posts: ${body.candidate.evidencePostIds.length}`,
      ],
      parseConfidence: body.candidate.confidence,
      sourceSnapshotId: undefined,
      decisionStatus: "unresolved",
      review: buildInitialReview({
        businessName,
        subtitle: subtitleParts.length ? subtitleParts.join(" · ") : "Created from manual hashtag paste intake",
        bookingUrl: undefined,
        instagramUrl,
        heroImageUrl: undefined,
        services: [
          {
            id: `service_${crypto.createHash("md5").update(serviceTitle).digest("hex").slice(0, 8)}`,
            title: serviceTitle,
            subtitle: "Manual hashtag evidence",
          },
        ],
        providers: [
          {
            id: `provider_${crypto.createHash("md5").update(handle).digest("hex").slice(0, 8)}`,
            name: businessName,
            title: body.candidate.serviceHint || body.request.serviceHint,
          },
        ],
        portfolioImages: [],
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
      }),
    };

    await appendImportedProfileDraft(draft);
    return NextResponse.json({ ok: true as const, draftId: draft.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "draft_create_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
