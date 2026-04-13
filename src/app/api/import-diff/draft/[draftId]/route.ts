import { NextResponse } from "next/server";
import { getImportedProfileDraftById } from "@/lib/external-site-import/store";
import { buildDiffSummary } from "@/lib/import-diff/build-diff-summary";
import { findMergeTargetsForDraft } from "@/lib/import-diff/find-merge-targets";
import type { ComparableImportEntity } from "@/lib/import-diff/types";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await ctx.params;
    const id = decodeURIComponent(draftId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "draftId_required" }, { status: 400 });
    }
    const draft = await getImportedProfileDraftById(id);
    if (!draft) {
      return NextResponse.json({ ok: false as const, error: "draft_not_found" }, { status: 404 });
    }

    const { suggestions, topTarget } = await findMergeTargetsForDraft(draft);
    const imported: ComparableImportEntity = {
      id: draft.id,
      entityType: "imported_draft",
      businessName: draft.review.payload.businessName,
      sourceUrl: draft.sourceUrl,
      bookingUrl: draft.review.payload.bookingUrl,
      instagramUrl: draft.review.payload.instagramUrl,
      serviceCount: draft.review.payload.services.length,
      providerCount: draft.review.payload.providers.length,
      portfolioImageCount: draft.review.payload.portfolioImages.length,
    };

    return NextResponse.json({
      ok: true as const,
      suggestions,
      diffSummary: suggestions.length ? buildDiffSummary({ imported, topSuggestion: suggestions[0], target: topTarget }) : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
